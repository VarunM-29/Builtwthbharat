import React, { useState, useEffect, useRef } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { createX402Fetch } from '../utils/sentinelApi'

interface GraphNode {
  id: string;
  label: string;
  type: 'suspect' | 'victim' | 'phone' | 'bank' | 'location';
  val: number;
  score: number;
  // physics properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  weight: number;
}

const SENTINEL_TEMPLATES = {
  financial: `CASE REPORT: MHA/26189/DELHI
On 25th August, target Varun Mishra (+91-88123-45678) reported receiving spoofed calls from +91-98765-43210.
The caller posed as a bank manager and coerced Varun into transferring ₹5,000 to bank account HDFC-88234.
Cyber cell tracing discovered the phone number +91-98765-43210 is registered to prime suspect Aakash Sharma.
The receiving bank account HDFC-88234 belongs to Vaibhav Thakur, a known money mule acting on behalf of Aakash.`,
  campus: `INCIDENT REPORT: ABES/CYBER/09
Student Soumya Verma reported receiving phishing messages on campus.
The logs show the IP address resolved to a server hosted in ABES Campus.
IP logs linked the tech setup to suspect Utkarsh Sharma.
Utkarsh admitted to facilitating servers and call spoofing channels for Vansh Sirohi, the coordinator of the local phishing ring.`
}

const SentinelLink: React.FC = () => {
  const { activeAddress, signTransactions } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [isPaywallMode, setIsPaywallMode] = useState(false)
  const [inputText, setInputText] = useState(SENTINEL_TEMPLATES.financial)
  
  // Graph & Analysis States
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null)
  const [insights, setInsights] = useState<any>(null)
  const [shortestPath, setShortestPath] = useState<string[] | null>(null)

  // Dijkstra selection state
  const [sourceNodeId, setSourceNodeId] = useState('')
  const [targetNodeId, setTargetNodeId] = useState('')

  // Dragging state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4021'

  // Run a simple force-directed simulation in React
  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return

    let animationId: number
    const width = 600
    const height = 400

    // Initialize positions if not present
    const nodes = graph.nodes.map((node, idx) => ({
      ...node,
      x: node.x ?? width / 2 + Math.cos(idx) * 120 + (Math.random() - 0.5) * 20,
      y: node.y ?? height / 2 + Math.sin(idx) * 120 + (Math.random() - 0.5) * 20,
      vx: node.vx ?? 0,
      vy: node.vy ?? 0,
    }))

    const step = () => {
      const damping = 0.85
      const repulsion = 800
      const springLength = 90
      const springStrength = 0.05
      const centerStrength = 0.03

      // Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i]
          const n2 = nodes[j]
          const dx = n2.x! - n1.x!
          const dy = n2.y! - n1.y!
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < 250) {
            const force = repulsion / (dist * dist)
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force

            // Apply opposite force
            if (n1.id !== draggedNodeId) {
              n1.vx! -= fx
              n1.vy! -= fy
            }
            if (n2.id !== draggedNodeId) {
              n2.vx! += fx
              n2.vy! += fy
            }
          }
        }
      }

      // Attraction along edges
      graph.edges.forEach(edge => {
        const n1 = nodes.find(n => n.id === edge.from)
        const n2 = nodes.find(n => n.id === edge.to)
        if (n1 && n2) {
          const dx = n2.x! - n1.x!
          const dy = n2.y! - n1.y!
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = (dist - springLength) * springStrength
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force

          if (n1.id !== draggedNodeId) {
            n1.vx! += fx
            n1.vy! += fy
          }
          if (n2.id !== draggedNodeId) {
            n2.vx! -= fx
            n2.vy! -= fy
          }
        }
      })

      // Central gravity & boundaries
      nodes.forEach(node => {
        if (node.id === draggedNodeId) return

        // Pull to center
        node.vx! += (width / 2 - node.x!) * centerStrength
        node.vy! += (height / 2 - node.y!) * centerStrength

        // Apply friction
        node.x! += node.vx!
        node.y! += node.vy!
        node.vx! *= damping
        node.vy! *= damping

        // Keep inside boundaries
        node.x = Math.max(30, Math.min(width - 30, node.x!))
        node.y = Math.max(30, Math.min(height - 30, node.y!))
      })

      setGraph(prev => {
        if (!prev) return null
        return {
          ...prev,
          nodes: prev.nodes.map(n => {
            const updated = nodes.find(un => un.id === n.id)
            return updated ? { ...n, x: updated.x, y: updated.y, vx: updated.vx, vy: updated.vy } : n
          })
        }
      })

      animationId = requestAnimationFrame(step)
    }

    animationId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationId)
  }, [graph === null, draggedNodeId])

  const handleAnalyze = async () => {
    if (isPaywallMode) {
      if (!activeAddress) {
        setError('Please connect your wallet first')
        return
      }
      if (!signTransactions) {
        setError('Wallet does not support transaction signing')
        return
      }
    }

    if (!inputText.trim()) {
      setError('Please enter narrative report logs')
      return
    }

    setLoading(true)
    setError('')
    setPaymentStatus('')
    setGraph(null)
    setInsights(null)
    setShortestPath(null)

    try {
      let response: Response;

      if (isPaywallMode) {
        setPaymentStatus('Initializing payment...')
        const signer = {
          address: activeAddress,
          signTransactions: signTransactions,
        }

        setPaymentStatus('Processing payment (0.005 USDC)...')
        const fetchFn = await createX402Fetch(signer)
        
        response = await fetchFn(`${apiBaseUrl}/sentinel/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: inputText.trim(),
            sourceNode: sourceNodeId || undefined,
            targetNode: targetNodeId || undefined,
          }),
        })
      } else {
        // Free / Standalone Prototype mode
        setPaymentStatus('Running graph parser...')
        response = await fetch(`${apiBaseUrl}/api/free/sentinel/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: inputText.trim(),
            sourceNode: sourceNodeId || undefined,
            targetNode: targetNodeId || undefined,
          }),
        })
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} Request failed`)
      }

      const data = await response.json()
      if (data.success) {
        setPaymentStatus(isPaywallMode ? 'Payment settled! Analysis complete!' : 'Analysis complete!')
        setGraph(data.graph)
        setInsights(data.insights)
        setShortestPath(data.path)
        
        // Auto-select dropdown values if nodes exist
        if (data.graph.nodes.length > 1) {
          setSourceNodeId(data.graph.nodes[0].id)
          setTargetNodeId(data.graph.nodes[data.graph.nodes.length - 1].id)
        }
        
        setTimeout(() => setPaymentStatus(''), 3000)
      } else {
        throw new Error(data.details || 'Analysis failed')
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMsg)
      setPaymentStatus('')
    } finally {
      setLoading(false)
    }
  }

  // Trace connection path dynamically (re-runs pathfinder)
  const handleTracePath = async () => {
    if (!graph) return
    setLoading(true)
    try {
      // Free endpoint trigger since payment was already settled
      const response = await fetch(`${apiBaseUrl}/sentinel/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText.trim(),
          sourceNode: sourceNodeId,
          targetNode: targetNodeId,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setShortestPath(data.path)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Mouse drag handlers on SVG nodes
  const handleMouseDown = (nodeId: string) => {
    setDraggedNodeId(nodeId)
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedNodeId || !graph || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setGraph(prev => {
      if (!prev) return null
      return {
        ...prev,
        nodes: prev.nodes.map(node => {
          if (node.id === draggedNodeId) {
            return { ...node, x, y, vx: 0, vy: 0 }
          }
          return node
        })
      }
    })
  }

  const handleMouseUp = () => {
    setDraggedNodeId(null)
  }

  // Custom node styling
  const getNodeColor = (type: string, isHighlighted: boolean) => {
    if (isHighlighted) return '#facc15' // gold / yellow for path
    switch (type) {
      case 'suspect': return '#ef4444' // red
      case 'victim': return '#3b82f6' // blue
      case 'phone': return '#06b6d4' // cyan
      case 'bank': return '#10b981' // green
      case 'location': return '#8b5cf6' // purple
      default: return '#9ca3af'
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-2">
      {/* Left panel - input & control */}
      <div className="card bg-base-100 shadow-xl lg:col-span-5">
        <div className="card-body gap-4">
          <h2 className="card-title text-2xl flex items-center justify-between">
            <span>🛡️ Sentinel Link</span>
            <span className="badge badge-success gap-1">Algorand TestNet</span>
          </h2>
          
          <p className="text-sm text-base-content/70">
            Fusing telecom records (CDR) and case files (FIR) into an interactive link graph.
          </p>

          {/* Mode Selector Toggle */}
          <div className="form-control bg-base-200 p-2 rounded-lg border border-base-300">
            <label className="label cursor-pointer py-1">
              <span className="label-text font-semibold text-xs flex items-center gap-1">
                {isPaywallMode ? '🔒 Paywall Mode (Algorand x402)' : '🆓 Standalone Prototype (Free)'}
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={isPaywallMode}
                onChange={(e) => setIsPaywallMode(e.target.checked)}
              />
            </label>
          </div>

          {isPaywallMode ? (
            <div className="alert alert-warning py-2 text-xs">
              <div>
                <span>💰 Blockchain Cost: <span className="font-bold">₹0.40 INR</span> (0.005 USDC) per run</span>
              </div>
            </div>
          ) : (
            <div className="alert alert-success py-2 text-xs">
              <div>
                <span>✨ Free Mode: Bypassing paywall for direct local testing</span>
              </div>
            </div>
          )}

          {/* Preset templates */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-semibold text-xs">Select Case Template:</span>
            </label>
            <div className="flex gap-2">
              <button 
                className="btn btn-xs btn-outline btn-primary"
                onClick={() => setInputText(SENTINEL_TEMPLATES.financial)}
              >
                📞 Financial Fraud Log
              </button>
              <button 
                className="btn btn-xs btn-outline btn-secondary"
                onClick={() => setInputText(SENTINEL_TEMPLATES.campus)}
              >
                🏢 Campus Phishing Ring
              </button>
            </div>
          </div>

          {/* Narrative Input */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-semibold text-xs">FIR Narrative / CDR Record:</span>
            </label>
            <textarea
              className="textarea textarea-bordered h-44 font-mono text-xs leading-relaxed"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Action Button */}
          <button
            className={`btn btn-primary btn-md w-full ${loading ? 'loading' : ''}`}
            onClick={handleAnalyze}
            disabled={loading || !inputText.trim()}
          >
            {loading ? 'Analyzing...' : '🛡️ Analyze & Resolve (Pay ₹0.40 / $0.005 USDC)'}
          </button>

          {/* Status Message */}
          {paymentStatus && (
            <div className="alert alert-warning py-2 text-xs">
              <span>⏳ {paymentStatus}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="alert alert-error py-2 text-xs">
              <span>⚠️ {error}</span>
            </div>
          )}

          {/* Insights Panel */}
          {insights && (
            <div className="bg-base-200 p-3 rounded-lg text-xs space-y-1 mt-2">
              <p className="font-bold text-teal-600">📊 Entity Insights:</p>
              <p>• <b>Total Resolved Entities:</b> {insights.totalNodes}</p>
              <p>• <b>Identified Relationships:</b> {insights.totalEdges}</p>
              <p>• <b>Highest Centrality Suspect (Kingpin):</b> <span className="text-red-500 font-bold">{insights.kingpin}</span></p>
              <p className="text-[10px] text-base-content/60 mt-1">Checked on-chain at {insights.timestamp}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel - graph & dijkstra */}
      <div className="card bg-base-100 shadow-xl lg:col-span-7">
        <div className="card-body gap-4">
          <h2 className="card-title text-xl">🕸️ Interactive Relationship Canvas</h2>
          <p className="text-xs text-base-content/60">Drag nodes to clean up layout. High-risk targets are automatically scaled.</p>

          {/* Visual Canvas workspace */}
          <div className="border border-base-300 rounded-lg bg-base-200 h-[400px] flex items-center justify-center relative overflow-hidden">
            {graph ? (
              <svg
                ref={svgRef}
                className="w-full h-full cursor-crosshair select-none"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Render Edges */}
                {graph.edges.map((edge, idx) => {
                  const fromNode = graph.nodes.find(n => n.id === edge.from)
                  const toNode = graph.nodes.find(n => n.id === edge.to)
                  if (!fromNode || !toNode || fromNode.x === undefined || toNode.x === undefined || fromNode.y === undefined || toNode.y === undefined) return null

                  const isPath = shortestPath && 
                    ((shortestPath.indexOf(edge.from) !== -1 && shortestPath.indexOf(edge.to) !== -1) && 
                     Math.abs(shortestPath.indexOf(edge.from) - shortestPath.indexOf(edge.to)) === 1)

                  return (
                    <g key={`edge-${idx}`}>
                      <line
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        stroke={isPath ? '#eab308' : '#cbd5e1'}
                        strokeWidth={isPath ? 4 : 2}
                        strokeDasharray={edge.label.includes('spoofed') ? '5,5' : 'none'}
                        className="transition-all"
                      />
                      {/* Edge Label */}
                      <text
                        x={(fromNode.x + toNode.x) / 2}
                        y={(fromNode.y + toNode.y) / 2 - 4}
                        fill="#64748b"
                        fontSize="9"
                        textAnchor="middle"
                        className="bg-white"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )
                })}

                {/* Render Nodes */}
                {graph.nodes.map(node => {
                  if (node.x === undefined) return null
                  const isHighlighted = shortestPath?.includes(node.id) ?? false
                  const radius = node.val ?? 15

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x},${node.y})`}
                      className="cursor-pointer"
                      onMouseDown={() => handleMouseDown(node.id)}
                    >
                      {/* Shadow Ring */}
                      <circle
                        r={radius + 4}
                        fill="none"
                        stroke={isHighlighted ? '#eab308' : 'none'}
                        strokeWidth="3"
                        className="animate-pulse"
                      />
                      {/* Main Node Circle */}
                      <circle
                        r={radius}
                        fill={getNodeColor(node.type, isHighlighted)}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      {/* Node Label Text */}
                      <text
                        y={radius + 14}
                        fill="#1e293b"
                        fontSize="10"
                        fontWeight={node.type === 'suspect' ? 'bold' : 'normal'}
                        textAnchor="middle"
                      >
                        {node.label}
                      </text>
                      {/* PageRank Score badge inside circle */}
                      {radius > 16 && (
                        <text
                          y="3"
                          fill="#ffffff"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {node.score}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            ) : (
              <div className="text-center text-sm text-base-content/40 p-4">
                🔒 Upload narrative case files and complete payment to view link visualizer.
              </div>
            )}
          </div>

          {/* Dijkstra routing utility */}
          {graph && (
            <div className="bg-base-200 p-4 rounded-lg flex flex-col md:flex-row md:items-end gap-3 text-xs">
              <div className="form-control flex-1">
                <label className="label py-1">
                  <span className="label-text text-[10px] font-bold">Source Node:</span>
                </label>
                <select
                  className="select select-bordered select-xs w-full"
                  value={sourceNodeId}
                  onChange={(e) => setSourceNodeId(e.target.value)}
                >
                  {graph.nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label} ({n.type})</option>
                  ))}
                </select>
              </div>
              
              <div className="form-control flex-1">
                <label className="label py-1">
                  <span className="label-text text-[10px] font-bold">Target Node:</span>
                </label>
                <select
                  className="select select-bordered select-xs w-full"
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                >
                  {graph.nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label} ({n.type})</option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-secondary btn-xs h-[28px]"
                onClick={handleTracePath}
                disabled={loading}
              >
                🔍 Trace Connection Trail (Dijkstra)
              </button>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] justify-center mt-2 border-t border-base-200 pt-3">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Suspect / Agent</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Target / Victim</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-500 inline-block"></span> Telecom Log</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Bank Account</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block"></span> Location Spot</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span> Dijkstra Flow Trail</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SentinelLink
