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
/**
 * Zonal forums, which the tree flattens away.
 *
 * A zone is an administrative layer above regions, and whether a region sits
 * under one is a per-server configuration choice rather than anything a reader
 * would know or care about. On the aggregator that inconsistency is stark: 43
 * regions sit at the top level while 73 others are one tap further down, hidden
 * behind a zone, with nothing to distinguish the two groups. Dropping the zone
 * layer promotes its regions to the top so all of them are siblings.
 *
 * Meetings belong to regions and areas. A meeting registered directly against a
 * zone is a mistake in that server's data — 21 of them across 3 zones on the
 * aggregator — and this deliberately does not contort the tree to accommodate
 * it. Those meetings are still found by map and location search.
 */
const ZONE_TYPE = 'ZF';

export function buildServiceBodyTree(bodies: RawServiceBody[]): ServiceBodyNode[] {
  const nodes = new Map<string, ServiceBodyNode>();
  const parentOf = new Map<string, string>();
  // id → name, so a promoted body can be labelled with the zone it came out of.
  const zones = new Map<string, string>();

  for (const body of bodies) {
    if (!body?.id) continue;
    const id = String(body.id);
    parentOf.set(id, String(body.parent_id ?? '0'));
    // Recorded as a parent so its children can be re-pointed, but never given a
    // node of its own.
    if (body.type === ZONE_TYPE) zones.set(id, body.name ?? '');
    else nodes.set(id, { id, name: body.name ?? '', children: [] });
  }

  const roots: ServiceBodyNode[] = [];
  for (const [id, node] of nodes) {
    const { parentId, zone } = skipZones(id, parentOf, zones);
    node.name = labelWithZone(node.name, zone);
    const parent = parentId === '0' ? undefined : nodes.get(parentId);

    if (!parent || parent === node || isAncestor(node.id, parentId, parentOf)) roots.push(node);
    else parent.children.push(node);
  }

  sortTree(roots);
  return roots;
}

/**
 * Name a promoted body after the zone it was lifted out of.
 *
 * Flattening costs a region its context, and some regions are named only in
 * relation to their zone: the Iran Zone contains "Region 1" and "Region 3",
 * which say nothing at all once they are sitting between Buckeye Region and
 * Ontario Region. Appending the zone restores what the nesting used to convey
 * without putting the level back.
 *
 * Skipped when the name already carries the zone, so a "CANA Region" inside CANA
 * does not become "CANA Region (CANA)".
 */
function labelWithZone(name: string, zone: string): string {
  if (!zone || !name) return name;
  // Whole words, not a substring. Zone names are short acronyms, and a plain
  // `includes` sees "CANA" inside "Canada Atlantic Region" — leaving that one
  // bare while its four siblings all gained "(CANA)". Escaped because real names
  // carry brackets, e.g. "Région de Québec [CSRQ]".
  const escaped = zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escaped}\\b`, 'i').test(name)) return name;
  return `${name} (${zone})`;
}

/**
 * The nearest ancestor that is not a zone, plus the zone that was skipped to
 * reach it. `parentId` is `'0'` for the root, and `zone` is empty when nothing
 * was skipped.
 *
 * Walks rather than checking a single level, so a zone nested inside another
 * zone still collapses; the *nearest* zone is the one reported, since that is
 * the context the reader lost. The `seen` guard is the same defence as
 * `isAncestor`: malformed data that loops must terminate rather than hang.
 */
function skipZones(id: string, parentOf: Map<string, string>, zones: Map<string, string>): { parentId: string; zone: string } {
  let current = parentOf.get(id) ?? '0';
  let zone = '';
  const seen = new Set<string>([id]);
  while (current !== '0' && zones.has(current)) {
    if (!zone) zone = zones.get(current) ?? '';
    if (seen.has(current)) return { parentId: '0', zone };
    seen.add(current);
    current = parentOf.get(current) ?? '0';
  }
  return { parentId: current, zone };
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
