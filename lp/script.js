const revealElements = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12 },
);

for (const element of revealElements) observer.observe(element);

const header = document.querySelector(".site-header");
window.addEventListener(
  "scroll",
  () => header.classList.toggle("scrolled", window.scrollY > 40),
  { passive: true },
);
