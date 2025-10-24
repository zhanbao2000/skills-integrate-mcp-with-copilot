document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userIcon = document.getElementById("user-icon");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const closeModal = document.querySelector(".close");
  const teacherOnlyNotice = document.getElementById("teacher-only-notice");

  // Authentication state
  let authToken = localStorage.getItem("authToken");
  let isAuthenticated = false;
  let currentUser = null;

  // Check authentication status on load
  async function checkAuthStatus() {
    if (!authToken) {
      updateUIForGuest();
      return;
    }

    try {
      const response = await fetch("/auth/status", {
        headers: {
          Authorization: authToken,
        },
      });

      const result = await response.json();

      if (result.authenticated) {
        isAuthenticated = true;
        currentUser = result.username;
        updateUIForTeacher();
      } else {
        // Token is invalid, clear it
        localStorage.removeItem("authToken");
        authToken = null;
        updateUIForGuest();
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      updateUIForGuest();
    }
  }

  // Update UI for guest (not logged in)
  function updateUIForGuest() {
    isAuthenticated = false;
    currentUser = null;
    userIcon.classList.remove("logged-in");
    userIcon.title = "Login";
    teacherOnlyNotice.classList.remove("hidden");
    signupForm.classList.add("hidden");
  }

  // Update UI for teacher (logged in)
  function updateUIForTeacher() {
    userIcon.classList.add("logged-in");
    userIcon.title = `Logged in as ${currentUser} (click to logout)`;
    teacherOnlyNotice.classList.add("hidden");
    signupForm.classList.remove("hidden");
  }

  // User icon click handler
  userIcon.addEventListener("click", () => {
    if (isAuthenticated) {
      // Logout
      logout();
    } else {
      // Show login modal
      loginModal.classList.remove("hidden");
    }
  });

  // Close modal
  closeModal.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
    loginMessage.classList.add("hidden");
  });

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginForm.reset();
      loginMessage.classList.add("hidden");
    }
  });

  // Handle login
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(
        `/login?username=${encodeURIComponent(
          username
        )}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Store token and update state
        authToken = result.token;
        currentUser = result.username;
        isAuthenticated = true;
        localStorage.setItem("authToken", authToken);

        // Update UI
        updateUIForTeacher();

        // Close modal
        loginModal.classList.add("hidden");
        loginForm.reset();
        loginMessage.classList.add("hidden");

        // Refresh activities to show delete buttons
        fetchActivities();

        // Show success message
        messageDiv.textContent = `Welcome, ${currentUser}!`;
        messageDiv.className = "success";
        messageDiv.classList.remove("hidden");
        setTimeout(() => {
          messageDiv.classList.add("hidden");
        }, 3000);
      } else {
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      loginMessage.textContent = "Login failed. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Logout function
  async function logout() {
    try {
      await fetch("/logout", {
        method: "POST",
        headers: {
          Authorization: authToken,
        },
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    // Clear local state regardless of server response
    localStorage.removeItem("authToken");
    authToken = null;
    updateUIForGuest();

    // Refresh activities to hide delete buttons
    fetchActivities();

    // Show message
    messageDiv.textContent = "Logged out successfully";
    messageDiv.className = "info";
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 3000);
  }


  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons only if teacher is logged in
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li>
                        <span class="participant-email">${email}</span>
                        ${
                          isAuthenticated
                            ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                            : ""
                        }
                      </li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (only if authenticated)
      if (isAuthenticated) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isAuthenticated) {
      messageDiv.textContent = "Please login as a teacher to unregister students";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: authToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      messageDiv.textContent = "Please login as a teacher to register students";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: authToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkAuthStatus().then(() => {
    fetchActivities();
  });
});
