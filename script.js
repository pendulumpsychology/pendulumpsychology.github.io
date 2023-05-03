document.addEventListener('DOMContentLoaded', function() {
    function loadComponent(component, elementId) {
      return fetch(component)
        .then((response) => response.text())
        .then((html) => {
          document.getElementById(elementId).innerHTML = html;
        })
        .catch((error) => {
          console.warn('Error loading', component, error);
        });
    }
  
    Promise.all([
      loadComponent('/navbar.html', 'navbar-container'),
      loadComponent('/footer.html', 'footer-container')
    ]).then(() => {
      document.getElementById("toggle").addEventListener("click", function() {
        const toggleButton = document.getElementById("toggle");
        const navButtons = document.querySelectorAll(".nav-button");
  
        if (toggleButton.textContent === "Expand menu") {
          for (const navButton of navButtons) {
            navButton.style.display = "block";
          }
          toggleButton.textContent = "Collapse menu";
        } else {
          for (const navButton of navButtons) {
            navButton.style.display = "none";
          }
          toggleButton.textContent = "Expand menu";
        }
      });
      function adjustMainOffset() {
        const navbar = document.getElementById("navbar");
        const main = document.getElementById("main");
        const navbarHeight = navbar.offsetHeight;
      
        main.style.marginTop = `${navbarHeight}px`;
      }
      adjustMainOffset();
      window.addEventListener("resize", adjustMainOffset);
    });
  });
  