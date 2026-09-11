export function buildSplitJoinPairs(graph) {
    if (!graph || !graph.vertices || !graph.edges) {
        return {
            splitJoinPairs: [],
            siblingPairs: []
        };
    }

    const normalizeConstraint = value => {
        if (value === undefined || value === null || value === '') return 0;
        if (value === 'ϵ' || value === 'epsilon' || value === 'EPS') return 0;
        return value;
    };

    const getVertexId = vertex => vertex?.id ?? vertex?.name ?? vertex;

    const splitPoints = [...graph.vertices].filter(vertex => {
        const outgoingArcs = graph.edges.filter(edge => getVertexId(edge.from) === getVertexId(vertex));
        return outgoingArcs.length > 1;
    });

    const joinPoints = [...graph.vertices].filter(vertex => {
        const incomingArcs = graph.edges.filter(edge => getVertexId(edge.to) === getVertexId(vertex));
        return incomingArcs.length > 1;
    });

    const findSimplePaths = (startId, endId) => {
        const paths = [];

        const dfs = (currentId, path, visited) => {
            if (currentId === endId) {
                paths.push([...path]);
                return;
            }

            const outgoingArcs = graph.edges.filter(edge => getVertexId(edge.from) === currentId);

            for (const edge of outgoingArcs) {
                const nextId = getVertexId(edge.to);
                if (visited.has(nextId)) continue;

                visited.add(nextId);
                path.push(nextId);
                dfs(nextId, path, visited);
                path.pop();
                visited.delete(nextId);
            }
        };

        dfs(startId, [startId], new Set([startId]));
        return paths;
    };

    const splitJoinPairs = [];

    for (const split of splitPoints) {
        for (const join of joinPoints) {
            const splitId = getVertexId(split);
            const joinId = getVertexId(join);

            const incomingArcs = graph.edges.filter(edge => getVertexId(edge.to) === joinId);
            const distinctIncomingC = [...new Set(incomingArcs.map(edge => normalizeConstraint(edge.constraint ?? edge.C ?? 0)))];
            const joinType = distinctIncomingC.length > 1
                ? (distinctIncomingC.includes(0) ? 'MIX' : 'AND')
                : 'OR';

            const paths = findSimplePaths(splitId, joinId);

            splitJoinPairs.push({
                key: `${splitId}-${joinId}`,
                splitId,
                joinId,
                splitVertexId: splitId,
                joinVertexId: joinId,
                splitVertex: split,
                joinVertex: join,
                join_type: joinType,
                pathCount: paths.length,
                paths
            });
        }
    }

    const siblingPairs = splitJoinPairs.filter(pair => pair.pathCount > 1);

    return {
        splitJoinPairs,
        siblingPairs
    };
}
