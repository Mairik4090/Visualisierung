import { describe, it, expect } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import DefaultLayout from '@/layouts/default.vue';

describe('DefaultLayout navigation', () => {
  it('generates menu entries from router', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Home' },
        { path: '/about', name: 'About' },
        { path: '/stammbaum', name: 'Stammbaum' },
      ],
    });

    const wrapper = mount(DefaultLayout, {
      global: {
        plugins: [router],
        stubs: { NuxtLink: RouterLinkStub },
      },
    });
    await router.isReady();

    const links = wrapper.findAll('nav a');
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.text())).toEqual(['Home', 'About', 'Stammbaum']);
  });
});
