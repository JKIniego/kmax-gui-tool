import { findSiblings } from "../../well-handledness/src/Siblings.js";

export function buildSplitJoinPairs(graph) {
    if (!graph || !graph.vertices || !graph.edges) {
        return {
            siblingPaths: new Map(),
            allDisjointPaths: []
        };
    }

    const getVertexId = vertex => vertex?.id ?? vertex?.name ?? vertex;

    const adjacency = new Map();

    for (const vertex of graph.vertices) {
        adjacency.set(vertex, new Map());
    }

    for (const edge of graph.edges) {
        const fromVertex = [...graph.vertices].find(v => getVertexId(v) === getVertexId(edge.from));
        const toVertex = [...graph.vertices].find(v => getVertexId(v) === getVertexId(edge.to));

        if (!fromVertex || !toVertex) continue;

        const neighbors = adjacency.get(fromVertex) ?? new Map();
        neighbors.set(toVertex, (neighbors.get(toVertex) ?? 0) + 1);
        adjacency.set(fromVertex, neighbors);
    }

    const splitPoints = [...graph.vertices].filter(vertex => {
        const outgoingArcs = graph.edges.filter(edge => getVertexId(edge.from) === getVertexId(vertex));
        return outgoingArcs.length > 1;
    });

    const joinPoints = [...graph.vertices].filter(vertex => {
        const incomingArcs = graph.edges.filter(edge => getVertexId(edge.to) === getVertexId(vertex));
        return incomingArcs.length > 1;
    });

    return findSiblings(adjacency, new Set(splitPoints), new Set(joinPoints));
}
