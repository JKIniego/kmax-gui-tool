import { findSplitJoinPoints } from "../../well-handledness/src/Siblings.js";

function getNodeId(value) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return value.id ?? value.uid ?? value.name ?? value.identifier ?? value.label ?? null;
}

function normalizeGraphForSplitJoin(graph) {
  if (!graph || typeof graph !== "object") {
    return {};
  }

  if (Array.isArray(graph.vertices) && Array.isArray(graph.edges)) {
    const adjacency = {};

    for (const vertex of graph.vertices) {
      const id = getNodeId(vertex);
      if (id == null) continue;
      adjacency[id] = adjacency[id] || {};
    }

    for (const edge of graph.edges) {
      const from = edge?.from ?? edge?.source ?? edge?.fromVertex;
      const to = edge?.to ?? edge?.target ?? edge?.toVertex;
      const fromId = getNodeId(from);
      const toId = getNodeId(to);

      if (fromId == null || toId == null) continue;
      adjacency[fromId] = adjacency[fromId] || {};
      adjacency[toId] = adjacency[toId] || {};
      adjacency[fromId][toId] = true;
    }

    return adjacency;
  }

  return graph;
}

/**
 * Reuse the split/join detection from the well-handledness utilities and
 * return every split-join pair as a flat list of [split, join] tuples.
 *
 * This intentionally keeps the behavior minimal: it does not compute sibling
 * paths or validation outcomes, only the raw pair generation used by kmax
 * soundness checks.
 *
 * @param {Record<string, Record<string, unknown>> | { vertices: Array, edges: Array }} graph
 * @returns {Array<[string, string]>}
 */
export function findSplitJoinPairs(graph) {
  const normalizedGraph = normalizeGraphForSplitJoin(graph);
  let { splitPoints, joinPoints } = findSplitJoinPoints(normalizedGraph);

  if ((splitPoints?.size ?? 0) === 0 && (joinPoints?.size ?? 0) === 0) {
    const fallbackSplitPoints = new Set();
    const fallbackJoinPoints = new Set();

    for (const [node, neighbors] of Object.entries(normalizedGraph)) {
      const outDegree = Object.keys(neighbors || {}).length;
      const inDegree = Object.values(normalizedGraph).filter(candidate =>
        candidate && Object.prototype.hasOwnProperty.call(candidate, node)
      ).length;

      if (outDegree > 1) fallbackSplitPoints.add(node);
      if (inDegree > 1) fallbackJoinPoints.add(node);
    }

    splitPoints = fallbackSplitPoints;
    joinPoints = fallbackJoinPoints;
  }

  const pairs = [];

  for (const split of splitPoints) {
    for (const join of joinPoints) {
      pairs.push([split, join]);
    }
  }

  return pairs;
}

export default findSplitJoinPairs;
