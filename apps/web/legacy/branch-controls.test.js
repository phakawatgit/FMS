import { afterEach, describe, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/{borrow-form-faculty-branch,infirmary-visit-branch-lock,infirmary-visit-faculty-branch}.js");

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function load(name) {
  vi.resetModules();
  const path = Object.keys(scripts).find((key) => key.endsWith(`/${name}.js`));
  if (!path) throw new Error(`Missing legacy module: ${name}`);
  await scripts[path]();
}

function infirmaryFixture() {
  document.body.innerHTML = `
    <form id="visitForm">
      <label class="visitor-option" data-type="student"><input class="visitor-check" type="radio" name="visitorType" value="student" checked /></label>
      <label class="visitor-option" data-type="guest"><input class="visitor-check" type="radio" name="visitorType" value="guest" /></label>
      <select id="facultySelect"><option value="all">All</option><option value="engineering">Engineering</option><option value="agriculture">Agriculture</option><option value="business">Business</option></select>
      <select id="branchSelect"><option value="all">All</option></select>
      <select name="gender"><option value="all">All</option></select>
      <select name="blood"><option value="all">All</option></select>
      <select name="medicine"><option value="all">All</option></select>
    </form>`;
}

describe("legacy branch and visitor controls", () => {
  it("locks and clears the branch for guests, then resets it with the form", async () => {
    infirmaryFixture();
    await load("infirmary-visit-branch-lock");
    const branch = document.getElementById("branchSelect");
    branch.value = "engineering";
    const guest = document.querySelector('[data-type="guest"] input');
    guest.checked = true;
    guest.dispatchEvent(new Event("change", { bubbles: true }));
    expect(branch.disabled).toBe(true);
    expect(branch.value).toBe("");

    const student = document.querySelector('[data-type="student"] input');
    student.checked = true;
    student.dispatchEvent(new Event("change", { bubbles: true }));
    expect(branch.disabled).toBe(false);
    student.checked = false;
    guest.checked = false;
    guest.dispatchEvent(new Event("change", { bubbles: true }));
    expect(branch.disabled).toBe(false);

    const form = document.getElementById("visitForm");
    form.dispatchEvent(new Event("reset"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(branch.disabled).toBe(false);
    expect(branch.value).toBe("");
  });

  it("tolerates pages without an infirmary form", async () => {
    document.body.innerHTML = "";
    await load("infirmary-visit-branch-lock");
    expect(document.querySelector("#visitForm")).toBeNull();
  });

  it("filters infirmary branches by faculty and disables faculty controls for guests", async () => {
    infirmaryFixture();
    await load("infirmary-visit-faculty-branch");
    const faculty = document.getElementById("facultySelect");
    const branch = document.getElementById("branchSelect");
    expect(branch.options.length).toBeGreaterThan(2);
    faculty.value = "business";
    faculty.dispatchEvent(new Event("change", { bubbles: true }));
    expect(branch.options.length).toBe(3);

    const guest = document.querySelector('[data-type="guest"] input');
    guest.checked = true;
    guest.dispatchEvent(new Event("change", { bubbles: true }));
    expect(faculty.disabled).toBe(true);
    expect(branch.disabled).toBe(true);
    expect(faculty.value).toBe("all");
  });

  it("adds faculty selection to the borrow form and rebuilds its branch list", async () => {
    document.body.innerHTML = '<form><label><span>Branch</span><select name="branch"><option value="all">All</option></select></label></form>';
    await load("borrow-form-faculty-branch");
    const faculty = document.querySelector('select[name="faculty"]');
    const branch = document.querySelector('select[name="branch"]');
    expect(faculty).toBeInTheDocument();
    expect(branch.options.length).toBeGreaterThan(2);
    branch.value = branch.options[1].value;
    faculty.value = "engineering";
    faculty.dispatchEvent(new Event("change", { bubbles: true }));
    expect(branch.value).toBe(branch.options[1].value);
    const invalidFaculty = document.createElement("option");
    invalidFaculty.value = "unknown";
    faculty.append(invalidFaculty);
    faculty.value = "agriculture";
    faculty.dispatchEvent(new Event("change", { bubbles: true }));
    expect(branch.options.length).toBe(5);
    expect(branch.value).toBe("all");
  });

  it("skips the borrow faculty picker when there is no branch field", async () => {
    document.body.innerHTML = "";
    await load("borrow-form-faculty-branch");
    expect(document.querySelector(".borrow-faculty-field")).toBeNull();
  });

  it("keeps branch labels without spans and falls back for unknown faculty values", async () => {
    document.body.innerHTML = '<form><label>Branch<select name="branch"><option value="all">All</option></select></label></form>';
    await load("borrow-form-faculty-branch");
    const faculty = document.querySelector('select[name="faculty"]');
    const unknown = document.createElement("option");
    unknown.value = "unknown";
    faculty.append(unknown);
    faculty.value = "unknown";
    faculty.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector('select[name="branch"]').options.length).toBeGreaterThan(10);
    expect(document.querySelector('select[name="branch"]').closest("label").textContent).toContain("Branch");
  });
});
