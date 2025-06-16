import { describe, it, expect } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import ConceptDetail from '@/components/ConceptDetail.vue';
import type { Concept } from '@/types/concept';

// Stub for BaseModal
const BaseModalStub = {
  name: 'BaseModal',
  props: ['open'],
  emits: ['close'],
  template: `
    <div v-if="open" class="base-modal-stub">
      <slot />
      <button data-testid="modal-close-button" @click="$emit('close')">Modal Close</button>
    </div>
  `,
};

// Stub for NodeTimeline
const NodeTimelineStub = {
  name: 'NodeTimeline',
  props: ['concept'],
  template:
    '<div class="node-timeline-stub">Node Timeline for {{ concept?.name }}</div>',
};

const mockConcept: Concept = {
  id: 'test001',
  name: 'Test Concept Alpha',
  year: 2023,
  category: 'test-category',
  description: 'This is a detailed test description for Alpha.',
  dependencies: ['dep001', 'dep002'],
  contributions: 'Various test contributions.',
  references: [{ title: 'Test Ref 1', url: 'http://example.com/ref1' }],
  influenced: ['inf001'],
  tags: ['tagA', 'tagB'],
  year_of_origin: 2023, // Matching the field name used in template
  short_description: 'Short test desc for Alpha.', // Matching the field name used in template
};

describe('ConceptDetail.vue', () => {
  let wrapper: VueWrapper<InstanceType<typeof ConceptDetail>>;

  function mountComponent(concept: Concept | null = mockConcept) {
    wrapper = mount(ConceptDetail, {
      props: {
        concept: concept,
      },
      global: {
        stubs: {
          BaseModal: BaseModalStub,
          NodeTimeline: NodeTimelineStub,
        },
      },
    });
  }

  it('does not render if concept prop is null', () => {
    mountComponent(null);
    expect(wrapper.find('.concept-detail-container').exists()).toBe(false);
  });

  it('renders correctly when a concept prop is passed', () => {
    mountComponent();
    expect(wrapper.find('.concept-detail-container').exists()).toBe(true);
    expect(wrapper.html()).toContain(mockConcept.name);
    // For year and description, the template uses "Year of Origin" and "Short Description" as labels
    // and the prop values are concept.year and concept.description.
    // The component maps concept.year to "Year of Origin" and concept.description to "Short Description"
    // (as per the template <p><strong>Year of Origin:</strong> {{ concept.year }}</p>)
    expect(wrapper.html()).toContain(
      `<strong>Name:</strong> ${mockConcept.name}`,
    );
    expect(wrapper.html()).toContain(
      `<strong>Year of Origin:</strong> ${mockConcept.year}`,
    );
    expect(wrapper.html()).toContain(
      `<strong>Short Description:</strong> ${mockConcept.description}`,
    ); // In the component, concept.description is used for "Short Description"
  });

  it('displays placeholder texts for influence sections', () => {
    mountComponent();
    const influenceSections = wrapper.findAll('.influence-section');
    expect(influenceSections.length).toBe(2);

    expect(influenceSections[0].find('h3').text()).toBe('Beinflusst von:');
    expect(influenceSections[0].find('p').text()).toBe(
      '[Informationen demnächst verfügbar]',
    );

    expect(influenceSections[1].find('h3').text()).toBe(
      'Dieses Konzept beeinflusste:',
    );
    expect(influenceSections[1].find('p').text()).toBe(
      '[Informationen demnächst verfügbar]',
    );
  });

  it('emits @close event when the close button inside the component is clicked', async () => {
    mountComponent();
    const closeButton = wrapper.find('.close-button'); // The component's own close button
    expect(closeButton.exists()).toBe(true);

    await closeButton.trigger('click');

    expect(wrapper.emitted('close')).toBeTruthy();
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('emits @close event when BaseModal emits close (e.g., modal backdrop click)', async () => {
    mountComponent();
    // Simulate BaseModal emitting close
    // This requires finding the BaseModal stub and emitting from it,
    // or triggering an action on it that would cause it to emit.
    const modalStub = wrapper.findComponent(BaseModalStub);
    await modalStub.vm.$emit('close'); // Simulate the event from the stub

    expect(wrapper.emitted('close')).toBeTruthy();
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('renders NodeTimeline with the correct concept prop', () => {
    mountComponent();
    const nodeTimeline = wrapper.findComponent(NodeTimelineStub);
    expect(nodeTimeline.exists()).toBe(true);
    // The stub will render the name if concept is passed correctly
    expect(nodeTimeline.text()).toContain(
      `Node Timeline for ${mockConcept.name}`,
    );
  });
});
