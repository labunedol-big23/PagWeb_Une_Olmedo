const links = document.querySelectorAll(".galeria-scroll nav a");

links.forEach(link => {
    link.addEventListener("click", () => {

        // quitar activo anterior
        links.forEach(l => l.classList.remove("activo"));

        // agregar activo actual
        link.classList.add("activo");
    });
});