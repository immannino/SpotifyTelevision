import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

/** A TV code from a scanned QR link, kept through the Spotify login redirect. */
export const PENDING_CAST_KEY = 'stv:cast-pending'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Also the OAuth redirect target (?code=...), matching the URI registered with Spotify.
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
    { path: '/', name: 'dashboard', component: () => import('./views/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/dashboard', redirect: '/' },
    // The TV receiver. No Spotify login: the phone does the Spotify work.
    { path: '/tv', name: 'tv', component: () => import('./views/TvView.vue') },
    // Opened from the TV's QR code: log in on the phone so the TV can follow Spotify itself.
    { path: '/tv/connect', name: 'tv-connect', component: () => import('./views/ConnectTvView.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFoundView.vue') },
  ],
})

router.beforeEach((to) => {
  if (typeof to.query.cast === 'string') {
    sessionStorage.setItem(PENDING_CAST_KEY, to.query.cast)
    const { cast: _, ...query } = to.query
    return { ...to, query }
  }
  if (to.meta.requiresAuth && !useAuthStore().isAuthenticated) return { name: 'login' }
})

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}
