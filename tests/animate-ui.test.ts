import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('Animate UI skill integration', () => {
  it('skill is installed in .agents/skills with SKILL.md + recipes', () => {
    expect(fs.existsSync(path.join(ROOT, '.agents/skills/animate-ui/SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, '.agents/skills/animate-ui/references/catalog.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, '.agents/skills/animate-ui/references/rules.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, '.agents/skills/animate-ui/references/tokens.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, '.agents/skills/animate-ui/references/interactions/list.md'))).toBe(true);
    const lock = JSON.parse(read('skills-lock.json'));
    expect(lock.skills['animate-ui'].source).toBe('imskyleen/animate-ui');
  });

  it('packages are declared for path C (motion + @animate-ui/react)', () => {
    const pkg = JSON.parse(read('apps/web/package.json'));
    expect(pkg.dependencies['@animate-ui/react']).toMatch(/^\^?2\./);
    expect(pkg.dependencies['motion']).toMatch(/14/);
  });

  it('AnimateUIProvider wraps the whole app in root layout', () => {
    const layout = read('apps/web/src/app/layout.tsx');
    expect(layout).toContain('AnimateUIWrapper');
    const wrapper = read('apps/web/src/components/animate-ui/AnimateUIWrapper.tsx');
    expect(wrapper).toContain('AnimateUIProvider');
    expect(wrapper).toContain('@animate-ui/react/provider');
    expect(wrapper).toContain("'use client'");
  });

  it('demo uses only catalog primitives + motion tokens (no hand-rolled values)', () => {
    const demo = read('apps/web/src/components/animate-ui/AnimateUIDemo.tsx');
    // Catalog primitives
    expect(demo).toContain('@animate-ui/react/primitives/effects/effect');
    expect(demo).toContain('@animate-ui/react/primitives/effects/magnetic');
    expect(demo).toContain('@animate-ui/react/primitives/effects/tilt');
    expect(demo).toContain('@animate-ui/react/primitives/effects/click');
    expect(demo).toContain('@animate-ui/react/primitives/texts/splitting');
    expect(demo).toContain('@animate-ui/react/primitives/texts/counting-number');
    expect(demo).toContain('@animate-ui/react/primitives/texts/typing');
    // Tokens, never raw durations
    expect(demo).toContain('@animate-ui/react/utils/motion');
    expect(demo).toContain('useTempoTransition');
    expect(demo).toContain('ReducedMotionConfig');
    // Quality rules: popLayout + initial={false} + AnimatePresence around every exit
    expect(demo).toContain('mode="popLayout"');
    expect(demo).toContain('initial={false}');
    expect(demo).toContain('AnimatePresence');
    // Reduced motion: no transform strings, no width/height animation
    expect(demo).not.toMatch(/transform:\s*['"]scale\(/);
    expect(demo).not.toMatch(/animate=\{\{[^}]*\bwidth\b/);
  });

  it('demo route exists and renders the demo component', () => {
    expect(fs.existsSync(path.join(ROOT, 'apps/web/src/app/animate-test/page.tsx'))).toBe(true);
    const page = read('apps/web/src/app/animate-test/page.tsx');
    expect(page).toContain('AnimateUIDemo');
  });

  it('motion tokens keep Animate UI values (springs, not invented)', async () => {
    const motion = await import('@animate-ui/react/utils/motion');
    expect(motion.spring.press).toMatchObject({ stiffness: 550, damping: 30 });
    expect(motion.spring.pop).toMatchObject({ stiffness: 400, damping: 29 });
    expect(motion.blur.icon).toBeTruthy();
    expect(motion.scale.press).toBeCloseTo(0.97, 2);
    expect(motion.transition.swap.duration).toBeLessThanOrEqual(0.2);
  });
});