import type { RawServiceBody, ServiceBodyNode } from './types';

/**
 * Assemble the flat `GetServiceBodies` list into the region → area → group tree
 * the browse screens walk.
 *
 * Two properties matter more than they might look:
 *
 *  - **Nothing is dropped.** A body whose `parent_id` points at an id that is
 *    not in the response — which happens on the aggregator, where a region can
 *    be present while its parent zone is not — is promoted to the root instead
 *    of vanishing. The Ionic build's recursive filter silently discarded those
 *    subtrees along with every meeting underneath them.
 *  - **Cycles terminate.** Bad data that makes a body its own ancestor would
 *    send a naive recursive walk into an infinite loop; the ancestor walk below
 *    turns that into a root-level node instead of a hung app.
 *
 * It is also a single pass rather than the original's re-scan of the whole list
 * once per node, which mattered at ~7,000 aggregator service bodies.
 */
export function buildServiceBodyTree(bodies: RawServiceBody[]): ServiceBodyNode[] {
  const nodes = new Map<string, ServiceBodyNode>();
  const parentOf = new Map<string, string>();

  for (const body of bodies) {
    if (!body?.id) continue;
    const id = String(body.id);
    nodes.set(id, { id, name: body.name ?? '', children: [] });
    parentOf.set(id, String(body.parent_id ?? '0'));
  }

  const roots: ServiceBodyNode[] = [];
  for (const [id, node] of nodes) {
    const parentId = parentOf.get(id) ?? '0';
    const parent = parentId === '0' ? undefined : nodes.get(parentId);

    if (!parent || parent === node || isAncestor(node.id, parentId, parentOf)) roots.push(node);
    else parent.children.push(node);
  }

  sortTree(roots);
  return roots;
}

/**
 * Is `candidate` already somewhere above `start` in the tree?
 *
 * Walks the parent chain from `start`, so it costs the depth of the tree — a
 * handful of steps — rather than a rescan of every body.
 */
function isAncestor(candidate: string, start: string, parentOf: Map<string, string>): boolean {
  const seen = new Set<string>();
  let current: string | undefined = start;
  while (current && current !== '0') {
    if (current === candidate) return true;
    if (seen.has(current)) return true; // pre-existing loop higher up the chain
    seen.add(current);
    current = parentOf.get(current);
  }
  return false;
}

function sortTree(nodes: ServiceBodyNode[]): void {
  nodes.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  for (const node of nodes) sortTree(node.children);
}

/** Flatten to `id → name`, for turning a meeting's service body id into a label. */
export function serviceBodyNames(bodies: RawServiceBody[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const body of bodies) {
    if (body?.id) names.set(String(body.id), body.name ?? '');
  }
  return names;
}
