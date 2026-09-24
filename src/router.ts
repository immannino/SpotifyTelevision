import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Also the OAuth redirect target (?code=...), matching the URI registered with Spotify.
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
    { path: '/', name: 'dashboard', component: () => import('./views/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/dashboard', redirect: '/' },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFoundView.vue') },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !useAuthStore().isAuthenticated) return { name: 'login' }
})

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}
