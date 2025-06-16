<template>
  <div>
    <header class="site-header">
      <nav>
        <NuxtLink
          v-for="route in navRoutes"
          :key="route.path"
          :to="route.path"
          class="nav-link"
        >
          {{ route.meta.title || route.name }}
        </NuxtLink>
      </nav>
    </header>
    <main>
      <slot />
    </main>
    <footer class="site-footer">
      <p>&copy; 2024 KI-Stammbaum</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
  // Grundlayout mit automatischer Navigation
  import { computed } from 'vue';
  import { useRouter } from '#imports';

  const router = useRouter();

  const navRoutes = computed(() =>
    router
      .getRoutes()
      // Nur benannte, nicht-dynamische Routen außer Root und 404-Fallback
      .filter(
        (r) =>
          r.name &&
          !r.path.includes(':') &&
          r.path !== '/' &&
          r.path !== '/:pathMatch(.*)*',
      )
      // Alphabetische Sortierung nach Pfad
      .sort((a, b) => a.path.localeCompare(b.path)),
  );
</script>

<style scoped>
  .site-header {
    padding: 1rem;
    background-color: #f5f5f5;
  }

  .site-header nav a {
    margin-right: 0.5rem;
  }

  .nav-link {
    text-decoration: none;
    color: inherit;
  }

  .site-footer {
    padding: 1rem;
    background-color: #f5f5f5;
    text-align: center;
  }

  main {
    padding: 1rem;
  }
</style>
