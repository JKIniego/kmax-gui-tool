import {
  buildArcTagElement,
  buildElement,
  buildVertexTagElement,
} from "../../../utils.mjs";
import { VerificationsResultManager } from "../VerificationsResultManager.mjs";

export default class VERResultTabManager {
  /** @type {VerificationsResultManager} */
  #parentManager;

  /** @type {HTMLDivElement} */
  #rootElement;

  /**
   *
   * @type {{
   *   conclusion: {
   *       root: HTMLDivElement,
   *       title: HTMLDivElement,
   *       description: HTMLDivElement,
   *   },
   *   criteria: {
   *      section: HTMLDivElement,
   *      table: HTMLTableElement,
   *   },
   *   splitJoins: {
   *      section: HTMLDivElement,
   *      table: HTMLTableElement,
   *   },
   *   theoreticalNotes: {
   *      section: HTMLDivElement,
   *      content: HTMLDivElement,
   *   },
   *   violatingArcs: {
   *      section: HTMLDivElement,
   *      table: HTMLTableElement,
   *   },
   *   violatingVertices: {
   *      section: HTMLDivElement,
   *      table: HTMLTableElement,
   *   }
   * }}
   */
  #view = {
    conclusion: { root: null, title: null, description: null },
    criteria: { section: null, table: null },
    splitJoins: { section: null, table: null },
    theoreticalNotes: { section: null, content: null },
    violatingArcs: { section: null, table: null },
    violatingVertices: { section: null, table: null },
  };

  constructor(parentManager, rootElement) {
    this.#parentManager = parentManager;
    this.#rootElement = rootElement;

    this.#initializeView();
  }

  #initializeView() {
    const kmaxCheckButton = this.#rootElement.querySelector(
      "button[data-subaction='check-kmax']",
    );
    if (this.#parentManager.canCheckKmax) {
      kmaxCheckButton.classList.remove("hidden");
      kmaxCheckButton.addEventListener("click", () => {
        kmaxCheckButton.disabled = true;
        try {
          this.#parentManager.checkKmax();
        } finally {
          kmaxCheckButton.disabled = false;
        }
      });
    }

    const kmaxPAEButton = this.#rootElement.querySelector(
      "button[data-subaction='simulate-kmax-pae']",
    );
    if (this.#parentManager.canSimulateKmaxPAE) {
      kmaxPAEButton.classList.remove("hidden");
      kmaxPAEButton.addEventListener("click", async () => {
        kmaxPAEButton.disabled = true;
        try {
          await this.#parentManager.simulateKmaxPAE();
        } finally {
          kmaxPAEButton.disabled = false;
        }
      });
    }

    const exportKmaxReportButton = this.#rootElement.querySelector(
      "button[data-subaction='export-kmax-report']",
    );
    exportKmaxReportButton.addEventListener("click", () => {
      this.#parentManager.exportKmaxReport();
    });
    exportKmaxReportButton.classList.toggle(
      "hidden",
      !this.#parentManager.canExportKmaxReport,
    );

    this.#view.conclusion.root =
      this.#rootElement.querySelector(".status-chip");
    this.#view.conclusion.title =
      this.#rootElement.querySelector(".status-title");
    this.#view.conclusion.description = this.#rootElement.querySelector(
      ".status-description"
    );

    this.#view.criteria.section = this.#rootElement.querySelector(
      `[data-ver-section="criteria"]`
    );
    this.#view.criteria.table = this.#rootElement.querySelector(
      `[data-ver-section="criteria"] table`
    );
    this.#view.splitJoins.section = this.#rootElement.querySelector(
      `[data-ver-section="split-joins"]`
    );
    this.#view.splitJoins.table = this.#rootElement.querySelector(
      `[data-ver-section="split-joins"] table`
    );
    this.#view.theoreticalNotes.section = this.#rootElement.querySelector(
      `[data-ver-section="theoretical-notes"]`
    );
    this.#view.theoreticalNotes.content = this.#rootElement.querySelector(
      `[data-ver-section="theoretical-notes"] .theoretical-notes-content`
    );
    this.#view.violatingVertices.section = this.#rootElement.querySelector(
      `[data-ver-section="v-vertices"]`
    );
    this.#view.violatingVertices.table = this.#rootElement.querySelector(
      `[data-ver-section="v-vertices"] table`
    );
    this.#view.violatingArcs.section = this.#rootElement.querySelector(
      `[data-ver-section="v-arcs"]`
    );
    this.#view.violatingArcs.table = this.#rootElement.querySelector(
      `[data-ver-section="v-arcs"] table`
    );
  }

  /**
   *
   * @param {{
   *      name,
   *      evaluation: {
   *          conclusion: {
   *              pass,
   *              title,
   *              description
   *          },
   *          criteria: {
   *              pass, description
   *          }[],
   *          violating: {
   *              arcs: number[],
   *              vertices: number[]
   *          },
   *          violatingRemarks: {
   *              vertices: {[vertexUID: number]: string}
   *          },
   *      },
   *      model: {
   *          vertices: number[],
   *          arcs: number[]
   *      }
   * }} instance
   */
  displayInstanceResult(instance) {
    const {
      name,
      evaluation: {
        conclusion,
        criteria,
        kmax,
        splitJoins,
        violating,
        violatingRemarks,
      },
    } = instance;
    const exportKmaxReportButton = this.#rootElement.querySelector(
      "button[data-subaction='export-kmax-report']",
    );
    exportKmaxReportButton.classList.toggle(
      "hidden",
      !this.#parentManager.canExportKmaxReport,
    );

    // Setup conclusion chip
    if (conclusion.pass) {
      this.#view.conclusion.root.classList.add("passed");
    } else {
      this.#view.conclusion.root.classList.remove("passed");
    }

    this.#view.conclusion.title.innerHTML = conclusion.title;
    this.#view.conclusion.description.innerHTML = conclusion.description;

    // Setup criteria
    const criteriaSection = this.#view.criteria.section;
    const criteriaTableBody = this.#view.criteria.table.querySelector("tbody");
    criteriaTableBody.innerHTML = "";
    if (criteria && criteria.length > 0) {
      criteriaSection.classList.remove("hidden");
      for (const criterion of criteria) {
        const criteriaRow = buildElement("tr", { classname: "criteria-row" }, [
          buildElement("td", {}, [
            buildElement("i", {
              classname: "fas fa-" + (criterion.pass ? "check" : "close"),
            }),
          ]),
          buildElement("td", {}, [criterion.description]),
        ]);

        criteriaTableBody.appendChild(criteriaRow);
      }
    } else {
      criteriaSection.classList.add("hidden");
    }

    const splitJoinsSection = this.#view.splitJoins.section;
    const splitJoinsTableBody =
      this.#view.splitJoins.table.querySelector("tbody");
    splitJoinsTableBody.innerHTML = "";

    if (this.#parentManager.canExportKmaxReport) {
      splitJoinsSection.classList.remove("hidden");
      const formatCalculation = (value) =>
        Number.isFinite(value) ? String(value) : "-";

      if (!splitJoins?.length) {
        splitJoinsTableBody.appendChild(buildElement("tr", {}, [
          buildElement("td", {}, ["No split-join pairs identified"]),
        ]));
      }

      for (const splitJoin of splitJoins || []) {
        const expectedJm = splitJoin.expectedMergingJoins;
        const expectedJs = splitJoin.maxSeparatingJoins;
        const jmFormula = Number.isFinite(splitJoin.esplits) && Number.isFinite(kmax)
          ? `ceil(${splitJoin.esplits} / 2) - ${kmax} + 1 = ${formatCalculation(expectedJm)}`
          : formatCalculation(expectedJm);
        const jsFormula = Number.isFinite(kmax)
          ? `${kmax} - 1 = ${formatCalculation(expectedJs)}`
          : formatCalculation(expectedJs);
        const mergingPass = Number.isFinite(splitJoin.mergingJoins) &&
          Number.isFinite(expectedJm) &&
          splitJoin.mergingJoins === expectedJm;
        const separatingPass = Number.isFinite(splitJoin.separatingJoins) &&
          Number.isFinite(expectedJs) &&
          splitJoin.separatingJoins <= expectedJs;
        const pairDetails = [
          ["E-splits", formatCalculation(splitJoin.esplits)],
          [
            "Merging joins (Jm)",
            `${formatCalculation(splitJoin.mergingJoins)} counted; expected ${formatCalculation(expectedJm)} (${jmFormula}) - ${mergingPass ? "Pass" : "Fail"}`,
          ],
          [
            "Separating joins (Js)",
            `${formatCalculation(splitJoin.separatingJoins)} counted; maximum ${formatCalculation(expectedJs)} (${jsFormula}) - ${separatingPass ? "Pass" : "Fail"}`,
          ],
        ];
        const detailsTable = buildElement("table", {}, [
          buildElement("tbody", {}, pairDetails.map(([label, value]) =>
            buildElement("tr", {}, [
              buildElement("th", {}, [label]),
              buildElement("td", {}, [value]),
            ]),
          )),
        ]);
        const pairComponents = (splitJoin.vertices || [])
          .map((vertexUID) => this.#parentManager.getVertexIdentifier(vertexUID))
          .filter(Boolean);
        const pairResult = splitJoin.pass ? "Satisfied" : "Not satisfied";
        const pairSummary = buildElement("div", { classname: "vertex-tag" }, [
          buildElement("span", {}, [`L${splitJoin.level} `]),
          buildElement("span", {}, [
            pairComponents.length
              ? pairComponents.join(" → ")
              : splitJoin.pair || "Unidentified pair",
          ]),
          buildElement("span", {}, [` - kᵐᵃˣ-ensuring: ${pairResult}`]),
        ]);
        if (splitJoin.reason) {
          pairSummary.append(buildElement("div", {}, [splitJoin.reason]));
        }

        splitJoinsTableBody.appendChild(buildElement("tr", {}, [
          buildElement("td", { colspan: "2" }, [pairSummary, detailsTable]),
        ]));
      }
    } else {
      splitJoinsSection.classList.add("hidden");
    }

    // Setup theoretical notes
    const theoreticalNotesSection = this.#view.theoreticalNotes.section;
    const theoreticalNotesContent = this.#view.theoreticalNotes.content;
    theoreticalNotesContent.innerHTML = "";
    
    // Check if this instance has theoretical notes (added by soundness-service for lazy soundness)
    const theoreticalNote = instance.evaluation?.theoreticalNote;
    if (theoreticalNote) {
      theoreticalNotesSection.classList.remove("hidden");
      
      const noteElement = buildElement("div", { classname: "theoretical-note" }, [
        buildElement("div", { classname: "note-theorem" }, [theoreticalNote.theorem]),
        buildElement("div", { classname: "note-statement" }, [theoreticalNote.statement]),
        buildElement("div", { classname: "note-explanation" }, [theoreticalNote.explanation])
      ]);
      
      theoreticalNotesContent.appendChild(noteElement);
    } else {
      theoreticalNotesSection.classList.add("hidden");
    }

    // Setup violating arcs
    const violatingArcsSection = this.#view.violatingArcs.section;
    const violatingArcsTableBody =
      this.#view.violatingArcs.table.querySelector("tbody");
    violatingArcsTableBody.innerHTML = "";

    // Dynamic header: "Shared Arc" instance shows "Shared Arc", all others show "Violating Arcs"
    const arcsHeader = violatingArcsSection.querySelector("header");
    if (arcsHeader) {
      arcsHeader.textContent = (name === "Shared Arc") ? "Shared Arc" : "Violating Arcs";
    }

    if (violating?.arcs && violating.arcs.length > 0) {
      violatingArcsSection.classList.remove("hidden");
      for (const arcUID of violating.arcs) {
        const identifierPair = this.#parentManager.getArcIdentifierPair(arcUID);
        const row = buildElement("tr", {}, [
          buildElement("td", {}, [buildArcTagElement(...identifierPair)]),
          buildElement("td", {}, [violatingRemarks?.arcs[arcUID] || ""]),
        ]);

        violatingArcsTableBody.appendChild(row);
      }
    } else {
      violatingArcsSection.classList.add("hidden");
    }

    // Setup violating vertices
    const violatingVerticesSection = this.#view.violatingVertices.section;
    const violatingVerticesTableBody =
      this.#view.violatingVertices.table.querySelector("tbody");
    violatingVerticesTableBody.innerHTML = "";

    if (violating?.vertices && violating.vertices.length > 0) {
      violatingVerticesSection.classList.remove("hidden");
      for (const vertexUID of violating.vertices) {
        const identifier = this.#parentManager.getVertexIdentifier(vertexUID);
        const row = buildElement("tr", {}, [
          buildElement("td", {}, [buildVertexTagElement(identifier)]),
          buildElement("td", {}, [violatingRemarks?.vertices[vertexUID] || ""]),
        ]);

        violatingVerticesTableBody.appendChild(row);
      }
    } else {
      violatingVerticesSection.classList.add("hidden");
    }
  }
}
