import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FilterControls from '@/components/FilterControls.vue';

describe('FilterControls', () => {
  it('emits selected filters', async () => {
    const wrapper = mount(FilterControls);
    await wrapper.find('input').setValue('2000');
    await wrapper.find('select').setValue('algorithm');
    await wrapper.find('button').trigger('click');

    const emitted = wrapper.emitted('filtersApplied');
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toEqual({ year: 2000, type: 'algorithm' });
  });
});
