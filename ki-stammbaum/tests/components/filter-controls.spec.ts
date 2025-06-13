import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FilterControls from '@/components/FilterControls.vue';

describe('FilterControls.vue', () => {
  it('renders two number inputs for Start Year and End Year, and a select for Type', () => {
    const wrapper = mount(FilterControls);

    const numberInputs = wrapper.findAll<HTMLInputElement>('input[type="number"]');
    expect(numberInputs.length).toBe(2);

    // Check for labels or placeholders to be more specific if needed
    const startYearInput = wrapper.find('#start-year-filter');
    const endYearInput = wrapper.find('#end-year-filter');
    const typeSelect = wrapper.find('#type-filter');

    expect(startYearInput.exists()).toBe(true);
    expect(endYearInput.exists()).toBe(true);
    expect(typeSelect.exists()).toBe(true);
  });

  it('emits filtersApplied event with correct payload when "Filter anwenden" is clicked', async () => {
    const wrapper = mount(FilterControls);

    const startYearInput = wrapper.find<HTMLInputElement>('#start-year-filter');
    const endYearInput = wrapper.find<HTMLInputElement>('#end-year-filter');
    const typeSelect = wrapper.find<HTMLSelectElement>('#type-filter');
    const applyButton = wrapper.find('button');

    await startYearInput.setValue('2000');
    await endYearInput.setValue('2010');
    await typeSelect.setValue('algorithm');
    await applyButton.trigger('click');

    const emittedEvents = wrapper.emitted('filtersApplied');
    expect(emittedEvents).toBeTruthy();
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents![0][0]).toEqual({
      startYear: 2000,
      endYear: 2010,
      type: 'algorithm',
    });
  });

  it('emits filtersApplied event with null for empty year inputs and selected type', async () => {
    const wrapper = mount(FilterControls);

    // No need to find them again if not setting values
    // const startYearInput = wrapper.find<HTMLInputElement>('#start-year-filter');
    // const endYearInput = wrapper.find<HTMLInputElement>('#end-year-filter');
    const typeSelect = wrapper.find<HTMLSelectElement>('#type-filter');
    const applyButton = wrapper.find('button');

    // Year inputs are empty by default (v-model is null)
    await typeSelect.setValue('concept');
    await applyButton.trigger('click');

    const emittedEvents = wrapper.emitted('filtersApplied');
    expect(emittedEvents).toBeTruthy();
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents![0][0]).toEqual({
      startYear: null, // Or NaN depending on how input[type=number] handles empty strings. Vue usually converts to null or empty string.
      endYear: null,   // Let's assume it becomes null based on current component logic (ref<number | null>)
      type: 'concept',
    });
  });

  it('emits filtersApplied event with null for years if inputs are cleared', async () => {
    const wrapper = mount(FilterControls);

    const startYearInput = wrapper.find<HTMLInputElement>('#start-year-filter');
    const endYearInput = wrapper.find<HTMLInputElement>('#end-year-filter');
    const typeSelect = wrapper.find<HTMLSelectElement>('#type-filter');
    const applyButton = wrapper.find('button');

    await startYearInput.setValue('2000'); // Set initial value
    await endYearInput.setValue('2010');   // Set initial value
    await typeSelect.setValue('technology');

    // Clear the inputs - setting value to empty string for number input
    // should result in null for the v-model if it's typed as number | null
    await startYearInput.setValue('');
    await endYearInput.setValue('');

    await applyButton.trigger('click');

    const emittedEvents = wrapper.emitted('filtersApplied');
    expect(emittedEvents).toBeTruthy();
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents![0][0]).toEqual({
      startYear: null, // Vue number inputs with empty value bound to `number | null` model usually result in `null`
      endYear: null,
      type: 'technology',
    });
  });

   it('emits filtersApplied event with empty type if "Alle" is selected', async () => {
    const wrapper = mount(FilterControls);

    const startYearInput = wrapper.find<HTMLInputElement>('#start-year-filter');
    const endYearInput = wrapper.find<HTMLInputElement>('#end-year-filter');
    const typeSelect = wrapper.find<HTMLSelectElement>('#type-filter'); // Default is "Alle" (value="")
    const applyButton = wrapper.find('button');

    await startYearInput.setValue('1990');
    await endYearInput.setValue('1995');
    await typeSelect.setValue(''); // Explicitly select "Alle"

    await applyButton.trigger('click');

    const emittedEvents = wrapper.emitted('filtersApplied');
    expect(emittedEvents).toBeTruthy();
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents![0][0]).toEqual({
      startYear: 1990,
      endYear: 1995,
      type: '',
    });
  });
});
