const EPSILON = "ε";

function getVertexId(vertex) {
    return vertex?.uid ?? vertex?.vuid ?? vertex?.id ?? vertex;
}

function getArcEndpoints(arc) {
    return {
        from: getVertexId(arc.fromVertexUID ?? arc.from),
        to: getVertexId(arc.toVertexUID ?? arc.to)
    };
}

function getConstraint(arc) {
    const constraint = arc.c ?? arc.C ?? arc.constraint;
    return constraint === "E" || constraint === "epsilon" || constraint === ""
        ? EPSILON
        : (constraint ?? EPSILON);
}

function buildContractionMatrices(vertices, arcs) {
    const RV_adj = Object.fromEntries(
        vertices.map(from => [from, Object.fromEntries(vertices.map(to => [to, 0]))])
    );
    const RV_C = Object.fromEntries(
        vertices.map(from => [
            from,
            Object.fromEntries(vertices.map(to => [to, new Set()]))
        ])
    );

    for (const arc of arcs) {
        const endpoints = getArcEndpoints(arc);
        const from = vertices.find(vertex => String(vertex) === String(endpoints.from));
        const to = vertices.find(vertex => String(vertex) === String(endpoints.to));
        if (from === undefined || to === undefined) continue;
        RV_adj[from][to] += 1;
        RV_C[from][to].add(getConstraint(arc));
    }

    return { RV_adj, RV_C };
}

/**
 * Apply one matrix contraction, absorbing y into x.
 * Returns new vertex, adjacency, and constraint matrices without mutating input.
 */
export function MatrixContractionUpdate(vertices, RV_adj, RV_C, x, y, U = []) {
    const nextVertices = vertices.filter(vertex => vertex !== x && vertex !== y);
    const z = Symbol("contracted-vertex");
    const constraints = Object.fromEntries(
        vertices.map(from => [
            from,
            Object.fromEntries(vertices.map(to => [to, new Set(RV_C[from][to])]))
        ])
    );
    nextVertices.push(z);

    const nextAdj = Object.fromEntries(
        nextVertices.map(from => [from, Object.fromEntries(nextVertices.map(to => [to, 0]))])
    );
    const nextConstraints = Object.fromEntries(
        nextVertices.map(from => [
            from,
            Object.fromEntries(nextVertices.map(to => [to, new Set()]))
        ])
    );

    for (const u of U) {
        if (u !== x && u !== y) constraints[u][y] = new Set([EPSILON]);
    }

    for (const from of nextVertices) {
        for (const to of nextVertices) {
            if (from === z && to === z) continue;
            const oldFrom = from === z ? [x, y] : [from];
            const oldTo = to === z ? [x, y] : [to];

            for (const oldSource of oldFrom) {
                for (const oldTarget of oldTo) {
                    nextAdj[from][to] += RV_adj[oldSource][oldTarget] ?? 0;
                    for (const constraint of constraints[oldSource][oldTarget] ?? []) {
                        nextConstraints[from][to].add(constraint);
                    }
                }
            }
        }
    }

    return { vertices: nextVertices, RV_adj: nextAdj, RV_C: nextConstraints, z };
}

/**
 * Generate the sequential total contraction path from a source vertex.
 *
 * Input accepts either matrices (RV_adj and RV_C) or graph data (vertices and
 * arcs). Vertices may be IDs or objects with uid/vuid/id fields. Graph arcs
 * may use fromVertexUID/toVertexUID or from/to endpoints.
 */
export function generateTotalContractionPath(graphInput) {
    const vertices = [...new Set((graphInput.vertices ?? []).map(getVertexId))];
    const sourceId = getVertexId(graphInput.source);
    const source = vertices.find(vertex => String(vertex) === String(sourceId));
    if (source === undefined) {
        throw new Error("The contraction-path source must be in vertices.");
    }

    const matrices = graphInput.RV_adj && graphInput.RV_C
        ? { RV_adj: graphInput.RV_adj, RV_C: graphInput.RV_C }
        : buildContractionMatrices(vertices, graphInput.arcs ?? []);
    let activeVertices = vertices;
    let { RV_adj, RV_C } = matrices;
    let current = source;
    const P_Total = new Set([source]);
    let infeasibleCandidates = new Set();

    while (activeVertices.some(
        candidate => candidate !== current && RV_adj[current][candidate] >= 1
    )) {
        let selected = null;
        for (const candidate of activeVertices) {
            if (
                candidate === current ||
                RV_adj[current][candidate] < 1 ||
                infeasibleCandidates.has(candidate)
            ) continue;
            selected = candidate;
            break;
        }
        if (selected === null) {
            break;
        }

        const lhs = new Set(RV_C[current][selected]);
        lhs.add(EPSILON);

        const rhs = new Set();
        for (const u of activeVertices) {
            if (u === current || RV_adj[u][selected] < 1) continue;
            for (const constraint of RV_C[u][selected]) rhs.add(constraint);
        }

        const isFeasible = [...rhs].every(constraint => lhs.has(constraint));
        if (!isFeasible) {
            infeasibleCandidates.add(selected);
            continue;
        }

        const incoming = activeVertices.filter(
            vertex => vertex !== current && RV_adj[vertex][selected] > 0
        );
        const update = MatrixContractionUpdate(
            activeVertices, RV_adj, RV_C, current, selected, incoming
        );
        P_Total.add(selected);
        activeVertices = update.vertices;
        RV_adj = update.RV_adj;
        RV_C = update.RV_C;
        current = update.z;
        infeasibleCandidates = new Set();
    }

    return { P_Total };
}