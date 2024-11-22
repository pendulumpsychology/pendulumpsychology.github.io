document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('toggle').addEventListener('click', function () {
    const toggleButton = document.getElementById('toggle');
    const navButtons = document.querySelectorAll('.nav-button');

    if (toggleButton.textContent === 'Expand menu') {
      for (const navButton of navButtons) {
        navButton.style.display = 'flex';
      }
      toggleButton.textContent = 'Collapse menu';
    } else {
      for (const navButton of navButtons) {
        navButton.style.display = 'none';
      }
      toggleButton.textContent = 'Expand menu';
    }
  });

  function adjustMainOffset() {
    const navbar = document.getElementById('navbar');
    const main = document.querySelector('main[id="adjust-margin"]'); // Changed this line

    if (navbar && main) {
      const navbarHeight = navbar.offsetHeight;
      main.style.marginTop = `${navbarHeight}px`;
    } else {
      console.warn('Error: navbar or main element with id="adjust-margin" not found');
    }
  }

  adjustMainOffset();
  window.addEventListener('resize', adjustMainOffset);
});
