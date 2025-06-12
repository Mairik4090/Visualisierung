import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Timeline from '@/components/Timeline.vue';

describe('Timeline', () => {
  it('renders svg with bars', () => {
    const wrapper = mount(Timeline, {
      props: {
        nodes: [
          { id: 'a', name: 'A', year: 2000 },
          { id: 'b', name: 'B', year: 2000 },
          { id: 'c', name: 'C', year: 2001 },
        ],
      },
    });

    expect(wrapper.find('svg').exists()).toBe(true);
    // at least one bar should be drawn
    expect(wrapper.findAll('rect').length).toBeGreaterThan(0);
  });

  it('emits rangeChanged with initial range', () => {
    const wrapper = mount(Timeline, {
      props: {
        nodes: [
          { id: 'a', name: 'A', year: 2000 },
          { id: 'b', name: 'B', year: 2002 },
        ],
      },
    });
    const events = wrapper.emitted<'rangeChanged'>('rangeChanged');
    expect(events).toBeTruthy();
    const [range] = events![0];
    expect(range).toEqual([2000, 2002]);
  });

  it('emits new range when zoom buttons are used', async () => {
    const wrapper = mount(Timeline, {
      props: {
        nodes: [
          { id: 'a', name: 'A', year: 2000 },
          { id: 'b', name: 'B', year: 2001 },
          { id: 'c', name: 'C', year: 2002 },
        ],
      },
    });

    const initial = wrapper.emitted<'rangeChanged'>('rangeChanged')![0][0];

    await wrapper.find('button.zoom-in').trigger('click');
    const eventsAfterZoomIn = wrapper.emitted<'rangeChanged'>('rangeChanged')!;
    const afterZoomIn = eventsAfterZoomIn[eventsAfterZoomIn.length - 1][0];
    expect(afterZoomIn).not.toEqual(initial);

    await wrapper.find('button.zoom-out').trigger('click');
    const eventsAfterZoomOut = wrapper.emitted<'rangeChanged'>('rangeChanged')!;
    const afterZoomOut = eventsAfterZoomOut[eventsAfterZoomOut.length - 1][0];
    expect(afterZoomOut).not.toEqual(afterZoomIn);
  });

  it('emits yearSelected when a bar is clicked', async () => {
    const wrapper = mount(Timeline, {
      props: {
        nodes: [
          { id: 'a', name: 'A', year: 2000 },
        ],
      },
    });

    await wrapper.find('rect').trigger('click');
    const events = wrapper.emitted<'yearSelected'>('yearSelected');
    expect(events).toBeTruthy();
    expect(events![0]).toEqual([2000]);
  });

  it('changes number of bars when zoomed', async () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      name: `N${i}`,
      year: 1990 + i,
    }));

    const wrapper = mount(Timeline, { props: { nodes } });

    const initialBars = wrapper.findAll('rect').length;
    expect(initialBars).toBe(2);

    // programmatischer Zoom via applyZoom
    ;(wrapper.vm as any).applyZoom(4);
    await wrapper.vm.$nextTick();

    const zoomedBars = wrapper.findAll('rect').length;
    expect(zoomedBars).toBeGreaterThan(initialBars);
  });
});
