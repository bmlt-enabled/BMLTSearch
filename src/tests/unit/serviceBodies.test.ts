import { describe, expect, it } from 'vitest';
import { buildServiceBodyTree, serviceBodyNames } from '$lib/serviceBodies';
import type { RawServiceBody } from '$lib/types';

function body(id: string, parent: string, name: string): RawServiceBody {
  return { id, parent_id: parent, name };
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

  it('keeps every body it was given', () => {
    const bodies = [body('1', '0', 'A'), body('2', '1', 'B'), body('3', '404', 'C'), body('4', '2', 'D')];
    const count = (nodes: ReturnType<typeof buildServiceBodyTree>): number => nodes.reduce((total, node) => total + 1 + count(node.children), 0);
    expect(count(buildServiceBodyTree(bodies))).toBe(bodies.length);
  });
});

describe('serviceBodyNames', () => {
  it('maps id to name', () => {
    expect(serviceBodyNames([body('7', '0', 'Southern Region')]).get('7')).toBe('Southern Region');
  });
});
