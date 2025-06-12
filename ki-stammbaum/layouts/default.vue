<template>
  <div>
    <header class="site-header">
      <nav>
        <NuxtLink
          v-for="route in pageRoutes"
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

const router = useRouter();
const pageRoutes = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.path !== '/' && r.path !== '/:pathMatch(.*)*')
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
.site-footer {
  padding: 1rem;
  background-color: #f5f5f5;
  text-align: center;
}
main {
  padding: 1rem;
}
</style>
