
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { KnowledgeGraphData, KnowledgeGraphNode, KnowledgeGraphLink } from '../types';

interface KnowledgeGraphProps {
    data: KnowledgeGraphData;
}

const colorMap: { [key: string]: string } = {
    'paper_title': '#00FFFF', // neon-cyan
    'concept': '#FF00FF',     // neon-magenta
    'methodology': '#39FF14', // neon-lime
};

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data || !data.nodes || !data.links) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear previous graph

        const width = svg.node()!.getBoundingClientRect().width;
        const height = svg.node()!.getBoundingClientRect().height;
        
        const nodes: (KnowledgeGraphNode & d3.SimulationNodeDatum)[] = data.nodes.map(d => ({ ...d }));
        const links: d3.SimulationLinkDatum<d3.SimulationNodeDatum>[] = data.links.map(d => ({
            source: d.source,
            target: d.target,
            label: d.label,
        }));

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(30));

        const link = svg.append("g")
            .attr("stroke", "#2a2a2a")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", 1.5);

        const node = svg.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .call(drag(simulation) as any);

        node.append("circle")
            .attr("r", 10)
            .attr("fill", d => colorMap[d.group] || '#7DF9FF')
            .attr("stroke", d => colorMap[d.group] || '#7DF9FF')
            .attr("stroke-width", 2)
            .style("filter", d => `drop-shadow(0 0 3px ${colorMap[d.group] || '#7DF9FF'})`);

        node.append("text")
            .attr("x", 15)
            .attr("y", 5)
            .attr("fill", "#E0E0E0")
            .style("font-size", "12px")
            .text(d => d.label);
        
        node.append("title")
            .text(d => d.label);

        simulation.on("tick", () => {
            link
                .attr("x1", d => (d.source as any).x)
                .attr("y1", d => (d.source as any).y)
                .attr("x2", d => (d.target as any).x)
                .attr("y2", d => (d.target as any).y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        function drag(simulation: d3.Simulation<any, any>) {
            function dragstarted(event: any) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }
            function dragged(event: any) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }
            function dragended(event: any) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }
            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }

    }, [data]);

    return <svg ref={svgRef} width="100%" height="100%"></svg>;
};
