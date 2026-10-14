import type { Component } from 'vue';

import AppLayout from './AppLayout.vue';
import AuthLayout from './AuthLayout.vue';
import BlankLayout from './BlankLayout.vue';
import DefaultLayout from './DefaultLayout.vue';
import EmptyLayout from './EmptyLayout.vue';
import GuestLayout from './GuestLayout.vue';
import MainLayout from './MainLayout.vue';

import type { LayoutName } from './types';

export { default as AppLayout } from './AppLayout.vue';
export { default as AuthLayout } from './AuthLayout.vue';
export { default as BlankLayout } from './BlankLayout.vue';
export { default as DefaultLayout } from './DefaultLayout.vue';
export { default as EmptyLayout } from './EmptyLayout.vue';
export { default as GuestLayout } from './GuestLayout.vue';
export { default as MainLayout } from './MainLayout.vue';

export type { LayoutName } from './types';

export const layouts: Record<LayoutName, Component> = {
  default: DefaultLayout,
  main: MainLayout,
  app: AppLayout,
  auth: AuthLayout,
  guest: GuestLayout,
  blank: BlankLayout,
  empty: EmptyLayout
};

export default layouts;
