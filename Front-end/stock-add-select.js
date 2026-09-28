(function () {
  document.querySelectorAll(".details-grid select").forEach((select) => {
    const wrapper = document.createElement("div");
    wrapper.className = "minimal-select";
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "minimal-select-trigger";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    wrapper.appendChild(button);

    const list = document.createElement("div");
    list.className = "minimal-select-list";
    list.setAttribute("role", "listbox");
    wrapper.appendChild(list);

    const sync = () => {
      button.textContent = select.options[select.selectedIndex]?.textContent || "เลือก...";
      list.querySelectorAll("button").forEach((item, index) => item.classList.toggle("is-selected", index === select.selectedIndex));
    };
    select.hidden = true;
    select.classList.add("minimal-select-native");
    Array.from(select.options).forEach((option, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = option.textContent;
      item.setAttribute("role", "option");
      item.addEventListener("click", () => {
        select.selectedIndex = index;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        wrapper.classList.remove("is-open");
        button.setAttribute("aria-expanded", "false");
        sync();
      });
      list.appendChild(item);
    });
    button.addEventListener("click", () => {
      const open = wrapper.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(open));
    });
    select.addEventListener("change", sync);
    sync();
  });
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".minimal-select.is-open").forEach((wrapper) => {
      if (!wrapper.contains(event.target)) {
        wrapper.classList.remove("is-open");
        wrapper.querySelector(".minimal-select-trigger")?.setAttribute("aria-expanded", "false");
      }
    });
  });
})();
