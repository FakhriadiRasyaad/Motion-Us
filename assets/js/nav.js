// assets/js/nav.js

document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll(".navbar-links a");
  
    navLinks.forEach(link => {
      const linkPath = link.getAttribute("href").split("/").pop();
      if (linkPath === currentPath) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  });
  

// Hamburger Menu Toggle
const hamburger = document.getElementById('hamburger');
const navbarLinks = document.getElementById('navbarLinks');

// Create overlay element
const overlay = document.createElement('div');
overlay.className = 'navbar-overlay';
overlay.id = 'navbarOverlay';
document.body.appendChild(overlay);

// Toggle menu
function toggleMenu() {
  hamburger.classList.toggle('active');
  navbarLinks.classList.toggle('active');
  overlay.classList.toggle('active');
  
  // Prevent body scroll when menu open
  if (navbarLinks.classList.contains('active')) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

// Hamburger click
hamburger.addEventListener('click', toggleMenu);

// Overlay click
overlay.addEventListener('click', toggleMenu);

// Close menu saat klik link
navbarLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navbarLinks.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  });
});

// Close menu on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navbarLinks.classList.contains('active')) {
    toggleMenu();
  }
});

// Your existing logout code
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', function() {
    // Your logout logic here
  });
}
