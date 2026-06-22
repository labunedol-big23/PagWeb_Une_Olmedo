// SCROLL REVEAL SUAVE
const elements = document.querySelectorAll(".olmedo-section .reveal");

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add("active");
    }
  });
}, { threshold: 0.2 });

elements.forEach(el => observer.observe(el));

/* TICKER DINÁMICO */
const texto =
"✦ Colegio Olmedo ✦ Educación de calidad ✦ Formación integral ✦ Valores ✦ Futuro profesional ✦ ";

document.getElementById("olmedo-ticker-text").textContent = texto.repeat(6);

/* GALERÍA CON EFECTO DINÁMICO */
const imagenes = [
  "../img/Historia/imgH01.webp",
  "../img/Historia/imgH02.webp",
  "../img/Historia/imgH04.webp",
  "../img/Historia/imgH05.webp"
];

const contenedor = document.getElementById("olmedo-gallery");

imagenes.forEach((src, i) => {
  const img = document.createElement("img");
  img.src = src;

  // Animación de entrada tipo stagger
  img.style.opacity = 0;
  img.style.transform = "translateY(30px)";

  setTimeout(() => {
    img.style.transition = "all 0.8s ease";
    img.style.opacity = 1;
    img.style.transform = "translateY(0)";
  }, i * 200);

  contenedor.appendChild(img);
});

/* EFECTO PARALLAX SUAVE */
window.addEventListener("scroll", () => {
  document.querySelectorAll(".olmedo-hero").forEach(el => {
    el.style.backgroundPositionY = window.scrollY * 0.3 + "px";
  });
});