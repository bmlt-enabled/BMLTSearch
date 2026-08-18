import { describe, expect, it } from 'vitest';
import { buildServiceBodyTree, SEARCH_LIMIT, searchServiceBodies, serviceBodyNames } from '$lib/serviceBodies';
import type { RawServiceBody } from '$lib/types';

function body(id: string, parent: string, name: string, type = 'RS'): RawServiceBody {
  return { id, parent_id: parent, name, type };
}

/** A zonal forum — the one body type the tree flattens away. */
function zone(id: string, parent: string, name: string): RawServiceBody {
  return body(id, parent, name, 'ZF');
}

describe('buildServiceBodyTree', () => {
  it('nests children under their parent', () => {
    const tree = buildServiceBodyTree([body('1', '0', 'Region'), body('2', '1', 'Area'), body('3', '2', 'Group')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Region');
    expect(tree[0].children[0].name).toBe('Area');
    expect(tree[0].children[0].children[0].name).toBe('Group');
  });

  it('sorts siblings by name at every level', () => {
    const tree = buildServiceBodyTree([body('1', '0', 'Zulu'), body('2', '0', 'Alpha'), body('3', '1', 'Yankee'), body('4', '1', 'Bravo')]);
    expect(tree.map((node) => node.name)).toEqual(['Alpha', 'Zulu']);
    expect(tree[1].children.map((node) => node.name)).toEqual(['Bravo', 'Yankee']);
  });

  it('promotes an orphan to the root instead of discarding it', () => {
    // The aggregator regularly returns a region whose parent zone is absent. The
    // Ionic build's recursive filter dropped those, and every meeting under
    // them became unreachable.
    const tree = buildServiceBodyTree([body('5', '99', 'Orphaned Region'), body('6', '5', 'Its Area')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Orphaned Region');
    expect(tree[0].children[0].name).toBe('Its Area');
  });

  it('terminates on a cycle rather than recursing forever', () => {
    const tree = buildServiceBodyTree([body('1', '2', 'A'), body('2', '1', 'B')]);
    expect(tree.length).toBeGreaterThan(0);
    expect(tree.map((node) => node.name).sort()).toContain('A');
  });

  it('handles a body that is its own parent', () => {
    const tree = buildServiceBodyTree([body('1', '1', 'Self')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Self');
  });

  it('is empty for an empty response', () => {
    expect(buildServiceBodyTree([])).toEqual([]);
  });

  it('keeps every body it was given, zones aside', () => {
    const bodies = [body('1', '0', 'A'), body('2', '1', 'B'), body('3', '404', 'C'), body('4', '2', 'D')];
    const count = (nodes: ReturnType<typeof buildServiceBodyTree>): number => nodes.reduce((total, node) => total + 1 + count(node.children), 0);
    expect(count(buildServiceBodyTree(bodies))).toBe(bodies.length);
  });
});

describe('zonal forums are flattened away', () => {
  /**
   * Whether a region sits under a zone is a per-server configuration choice, so
   * on the aggregator 43 regions are top-level while 73 more hide one tap down
   * behind a zone, with nothing to tell the reader which is which.
   */
  it('promotes a zone\u2019s regions to the top level and drops the zone', () => {
    const tree = buildServiceBodyTree([zone('1', '0', 'Southeastern Zonal Forum'), body('2', '1', 'Carolina Region'), body('3', '1', 'Florida Region'), body('4', '0', 'Buckeye Region')]);
    expect(tree.map((node) => node.name)).toEqual(['Buckeye Region', 'Carolina Region (Southeastern Zonal Forum)', 'Florida Region (Southeastern Zonal Forum)']);
  });

  it('keeps what hangs beneath a promoted region', () => {
    const tree = buildServiceBodyTree([zone('1', '0', 'Zone'), body('2', '1', 'Region'), body('3', '2', 'Area'), body('4', '3', 'Group')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Region (Zone)');
    // Only the promoted body is relabelled — its descendants never lost context.
    expect(tree[0].children[0].name).toBe('Area');
    expect(tree[0].children[0].children[0].name).toBe('Group');
  });

  it('collapses a zone nested inside another zone, naming the nearest', () => {
    const tree = buildServiceBodyTree([zone('1', '0', 'Outer'), zone('2', '1', 'Inner'), body('3', '2', 'Region')]);
    expect(tree.map((node) => node.name)).toEqual(['Region (Inner)']);
  });

  it('drops meetings-bearing zones too \u2014 that is bad server data, not a shape to preserve', () => {
    // ABNA, Plains State and CANA each carry meetings directly on the
    // aggregator. Meetings belong to regions and areas; the tree does not bend
    // around 21 misfiled records.
    const tree = buildServiceBodyTree([zone('1', '0', 'CANA'), body('2', '1', 'Region')]);
    expect(tree.map((node) => node.name)).toEqual(['Region (CANA)']);
  });

  it('does not hang when a zone is its own parent', () => {
    const tree = buildServiceBodyTree([zone('1', '1', 'Loop'), body('2', '1', 'Region')]);
    expect(tree.map((node) => node.name)).toEqual(['Region (Loop)']);
  });

  it('leaves every other body type alone', () => {
    // Only ZF is flattened. Areas promoted to the root because their region is
    // missing from the response must stay — that is the orphan rescue.
    const tree = buildServiceBodyTree([body('1', '404', 'Orphan Area', 'AS'), body('2', '0', 'Region', 'RS')]);
    expect(tree.map((node) => node.name)).toEqual(['Orphan Area', 'Region']);
  });
});

describe('promoted bodies are labelled with the zone they came from', () => {
  /**
   * Flattening costs a region its context, and some are named only in relation
   * to their zone. The Iran Zone holds "Region 1" and "Region 3", which say
   * nothing once they sit between Buckeye Region and Ontario Region — the exact
   * confusion this reported: the promoted regions read as unnamed areas.
   */
  it('names a region that would otherwise be meaningless', () => {
    const tree = buildServiceBodyTree([zone('1', '0', 'Iran Zone'), body('2', '1', 'Region 1'), body('3', '1', 'Region 3')]);
    expect(tree.map((node) => node.name)).toEqual(['Region 1 (Iran Zone)', 'Region 3 (Iran Zone)']);
  });

  it('does not repeat a zone the name already carries', () => {
    const tree = buildServiceBodyTree([zone('1', '0', 'CANA'), body('2', '1', 'CANA Atlantic Region')]);
    expect(tree.map((node) => node.name)).toEqual(['CANA Atlantic Region']);
  });

  it('matches whole words only, so CANA does not hide inside Canada', () => {
    // The real case: CANA's five regions include "Canada Atlantic Region". A
    // substring check left that one bare while its four siblings were labelled.
    const tree = buildServiceBodyTree([zone('1', '0', 'CANA'), body('2', '1', 'Canada Atlantic Region'), body('3', '1', 'Ontario Region')]);
    expect(tree.map((node) => node.name)).toEqual(['Canada Atlantic Region (CANA)', 'Ontario Region (CANA)']);
  });

  it('handles a zone name containing regex characters', () => {
    // Real name from the aggregator: "Région de Québec [CSRQ]".
    const tree = buildServiceBodyTree([zone('1', '0', 'Zone [X]'), body('2', '1', 'Region')]);
    expect(tree.map((node) => node.name)).toEqual(['Region (Zone [X])']);
  });

  it('matches the existing name case-insensitively', () => {
    const tree = buildServiceBodyTree([zone('1', '0', 'cana'), body('2', '1', 'CANA Atlantic Region')]);
    expect(tree.map((node) => node.name)).toEqual(['CANA Atlantic Region']);
  });

  it('leaves a body that was never under a zone untouched', () => {
    const tree = buildServiceBodyTree([body('1', '0', 'Buckeye Region'), body('2', '1', 'WAGS Area', 'AS')]);
    expect(tree[0].name).toBe('Buckeye Region');
    expect(tree[0].children[0].name).toBe('WAGS Area');
  });

  it('survives a zone with no name', () => {
    const tree = buildServiceBodyTree([zone('1', '0', ''), body('2', '1', 'Region')]);
    expect(tree.map((node) => node.name)).toEqual(['Region']);
  });
});

describe('serviceBodyNames', () => {
  it('maps id to name', () => {
    expect(serviceBodyNames([body('7', '0', 'Southern Region')]).get('7')).toBe('Southern Region');
  });
});

describe('searchServiceBodies', () => {
  const tree = buildServiceBodyTree([
    body('1', '0', 'Buckeye Region'),
    body('2', '1', 'WAGS Area', 'AS'),
    body('3', '1', 'NE Ohio Area', 'AS'),
    body('4', '0', 'Région de Québec [CSRQ]'),
    body('5', '4', 'WAGS Area', 'AS')
  ]);

  it('finds a body nested anywhere in the tree', () => {
    expect(searchServiceBodies(tree, 'NE Ohio').map((m) => m.node.name)).toEqual(['NE Ohio Area']);
  });

  it('is case-insensitive', () => {
    expect(searchServiceBodies(tree, 'buckeye')).toHaveLength(1);
  });

  /**
   * The aggregator carries "Région de Québec [CSRQ]", "Región Española" and
   * "Área de Canarias". Nobody types those accents on a phone, and without
   * folding they conclude the body is missing.
   */
  it('ignores accents, so "quebec" finds "Québec"', () => {
    expect(searchServiceBodies(tree, 'region de quebec').map((m) => m.node.name)).toEqual(['Région de Québec [CSRQ]']);
  });

  /**
   * Area names repeat across regions — two different "WAGS Area"s here — so a
   * bare name would not say which one. The path is what disambiguates them.
   */
  it('returns the branch each match was found on', () => {
    const paths = searchServiceBodies(tree, 'WAGS').map((m) => m.path.join(' / '));
    expect(paths.sort()).toEqual(['Buckeye Region', 'Région de Québec [CSRQ]']);
  });

  it('gives a top-level body an empty path', () => {
    expect(searchServiceBodies(tree, 'Buckeye')[0].path).toEqual([]);
  });

  it('is empty for a blank or whitespace query rather than matching everything', () => {
    expect(searchServiceBodies(tree, '')).toEqual([]);
    expect(searchServiceBodies(tree, '   ')).toEqual([]);
  });

  it('stops at the cap — 1,600 bodies means a one-letter query is not a result set', () => {
    const many = buildServiceBodyTree(Array.from({ length: SEARCH_LIMIT + 20 }, (_, i) => body(String(i + 1), '0', `Area ${i}`, 'AS')));
    expect(searchServiceBodies(many, 'Area')).toHaveLength(SEARCH_LIMIT);
  });
});
