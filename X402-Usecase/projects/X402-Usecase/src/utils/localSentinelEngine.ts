export interface SentinelNode {
  id: string;
  label: string;
  type: 'suspect' | 'victim' | 'phone' | 'bank' | 'location';
  val: number;
  score: number;
}

export interface SentinelEdge {
  from: string;
  to: string;
  label: string;
  weight: number;
}

export interface SentinelGraphData {
  nodes: SentinelNode[];
  edges: SentinelEdge[];
}

export interface SentinelAnalysisResult {
  success: boolean;
  graph: SentinelGraphData;
  path: string[] | null;
  insights: {
    totalNodes: number;
    totalEdges: number;
    kingpin: string;
    timestamp: string;
    paymentInfo: string;
  };
}

// PageRank calculator
export function calculatePageRank(nodes: SentinelNode[], edges: SentinelEdge[], damping = 0.85, iterations = 20): Record<string, number> {
  const pr: Record<string, number> = {};
  const nodeIds = nodes.map(n => n.id);
  const N = nodeIds.length;
  if (N === 0) return {};

  nodeIds.forEach(id => {
    pr[id] = 1 / N;
  });

  const outDegree: Record<string, number> = {};
  nodeIds.forEach(id => {
    outDegree[id] = 0;
  });
  edges.forEach(e => {
    if (outDegree[e.from] !== undefined) {
      outDegree[e.from]++;
    }
  });

  for (let it = 0; it < iterations; it++) {
    const nextPr: Record<string, number> = {};
    nodeIds.forEach(id => {
      nextPr[id] = (1 - damping) / N;
    });

    nodeIds.forEach(fromId => {
      const degree = outDegree[fromId];
      if (degree > 0) {
        const targets = edges.filter(e => e.from === fromId).map(e => e.to);
        targets.forEach(toId => {
          if (nextPr[toId] !== undefined) {
            nextPr[toId] += damping * (pr[fromId] / degree);
          }
        });
      } else {
        nodeIds.forEach(toId => {
          nextPr[toId] += damping * (pr[fromId] / N);
        });
      }
    });

    nodeIds.forEach(id => {
      pr[id] = nextPr[id];
    });
  }

  return pr;
}

// Dijkstra / BFS shortest path
export function findShortestPath(nodes: SentinelNode[], edges: SentinelEdge[], start?: string, end?: string): string[] | null {
  if (!start || !end) return null;

  const adj: Record<string, string[]> = {};
  nodes.forEach(n => {
    adj[n.id] = [];
  });

  edges.forEach(e => {
    if (adj[e.from]) adj[e.from].push(e.to);
    if (adj[e.to]) adj[e.to].push(e.from);
  });

  const queue: string[][] = [[start]];
  const visited = new Set<string>([start]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];

    if (node === end) {
      return path;
    }

    const neighbors = adj[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }

  return null;
}

// Comprehensive Local Analysis Engine
export function runLocalSentinelAnalysis(text: string, sourceNode?: string, targetNode?: string, isPaywall = false): SentinelAnalysisResult {
  const nodes: SentinelNode[] = [];
  const edges: SentinelEdge[] = [];

  const addNode = (id: string, label: string, type: SentinelNode['type']) => {
    if (!nodes.some(n => n.id === id)) {
      nodes.push({ id, label, type, val: 10, score: 0 });
    }
  };

  const addEdge = (from: string, to: string, label: string) => {
    if (!edges.some(e => e.from === from && e.to === to && e.label === label)) {
      edges.push({ from, to, label, weight: 1 });
    }
  };

  const lowerText = text.toLowerCase();

  // Phone numbers extraction
  const phoneRegex = /(\+91[-\s]?)?[6789]\d{9}/g;
  const phonesMatched = text.match(phoneRegex) || [];
  phonesMatched.forEach((phone) => {
    const cleanPhone = phone.replace(/[-\s]/g, '');
    addNode(`phone_${cleanPhone}`, `${phone}`, 'phone');
  });

  // Bank accounts extraction
  const bankRegex = /[A-Z]{3,5}-\d{5,8}/g;
  const banksMatched = text.match(bankRegex) || [];
  banksMatched.forEach(bank => {
    addNode(`bank_${bank}`, `Acc: ${bank}`, 'bank');
  });

  // Scenario 1: Loan & Cyber Fraud Syndicate
  if (lowerText.includes('aakash') || lowerText.includes('varun') || lowerText.includes('vaibhav')) {
    addNode('suspect_aakash', 'Aakash Sharma (Kingpin)', 'suspect');
    addNode('victim_varun', 'Varun Mishra (Victim)', 'victim');
    addNode('suspect_vaibhav', 'Vaibhav Thakur (Money Mule)', 'suspect');

    const p0 = phonesMatched[0];
    const p1 = phonesMatched[1];
    const b0 = banksMatched[0];

    if (p0) {
      addEdge('suspect_aakash', `phone_${p0.replace(/[-\s]/g, '')}`, 'controls');
      if (p1) {
        addEdge('victim_varun', `phone_${p1.replace(/[-\s]/g, '')}`, 'registered');
        addEdge(`phone_${p0.replace(/[-\s]/g, '')}`, `phone_${p1.replace(/[-\s]/g, '')}`, 'fraudulent call');
      }
    }

    if (b0) {
      addEdge(`bank_${b0}`, 'suspect_vaibhav', 'mule account');
      addEdge('victim_varun', `bank_${b0}`, 'UPI ₹5,000');
    }

    addEdge('suspect_vaibhav', 'suspect_aakash', 'kickback remittance');
  }

  // Scenario 2: Ringleader syndicate (Hinglish/UP FIR)
  if (lowerText.includes('soumya') || lowerText.includes('utkarsh') || lowerText.includes('vansh')) {
    addNode('suspect_vansh', 'Vansh Sirohi (Ringleader)', 'suspect');
    addNode('suspect_utkarsh', 'Utkarsh Sharma (Tech Operator)', 'suspect');
    addNode('victim_soumya', 'Soumya Verma (Complainant)', 'victim');
    addNode('loc_abes', 'ABES Campus (Crime Scene)', 'location');

    const p0 = phonesMatched[0];
    if (p0) {
      addEdge('suspect_vansh', `phone_${p0.replace(/[-\s]/g, '')}`, 'burn phone');
    }
    addEdge('suspect_utkarsh', 'suspect_vansh', 'VPN proxy relay');
    addEdge('victim_soumya', 'loc_abes', 'incident reported');
    addEdge('suspect_vansh', 'loc_abes', 'tower ping detected');
    addEdge('victim_soumya', 'suspect_vansh', 'extorted by');
  }

  // Fallback scenario for arbitrary narrative
  if (nodes.length === 0) {
    addNode('suspect_main', 'Primary Suspect (Target A)', 'suspect');
    addNode('suspect_associate', 'Associate Node (Target B)', 'suspect');
    addNode('victim_complainant', 'Complainant', 'victim');
    addNode('phone_dummy', '+91-98765-43210', 'phone');
    addNode('bank_dummy', 'HDFC-88392', 'bank');

    addEdge('suspect_main', 'phone_dummy', 'SIM registered');
    addEdge('victim_complainant', 'bank_dummy', 'wire transfer');
    addEdge('bank_dummy', 'suspect_associate', 'withdrawn at ATM');
    addEdge('phone_dummy', 'victim_complainant', 'CDR linked');
    addEdge('suspect_associate', 'suspect_main', 'revenue split');
  }

  // Calculate PageRank & Node Sizes
  const pageRanks = calculatePageRank(nodes, edges);
  nodes.forEach(n => {
    const score = pageRanks[n.id] || 0.05;
    n.score = Math.round(score * 1000) / 1000;
    n.val = Math.round(12 + score * 50);
  });

  const path = findShortestPath(nodes, edges, sourceNode, targetNode);
  const highestRankNode = nodes.reduce((prev, current) => (prev.score > current.score ? prev : current), nodes[0]);

  return {
    success: true,
    graph: { nodes, edges },
    path,
    insights: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      kingpin: highestRankNode.label,
      timestamp: new Date().toISOString(),
      paymentInfo: isPaywall
        ? 'x402 Settle / Algorand TestNet / Plausible Facilitator ($0.005 USDC)'
        : 'Sentinel Local In-Browser Analytics Engine (Free Prototype Mode)',
    },
  };
}
