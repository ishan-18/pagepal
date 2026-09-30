import { defineComponent, onBeforeUnmount, onMounted, shallowRef, type PropType, type ShallowRef } from 'vue';
import { createPal, type FormTarget, type Pal, type PalOptions, type WatchRequestsOptions } from 'pagepal';

/**
 * Create a pal for the lifetime of the component. Options are read once, on
 * mount. The ref is `null` until mounted (and during SSR).
 */
export function usePal(options: PalOptions = {}): ShallowRef<Pal | null> {
  const pal = shallowRef<Pal | null>(null);
  onMounted(() => {
    pal.value = createPal(options);
  });
  onBeforeUnmount(() => {
    pal.value?.destroy();
    pal.value = null;
  });
  return pal;
}

/**
 * Renders nothing; puts a pal on the page while mounted.
 *
 * ```vue
 * <PagePal watch="form#signup" requests :options="{ character: 'cat' }" />
 * ```
 */
export const PagePal = defineComponent({
  name: 'PagePal',
  props: {
    options: { type: Object as PropType<PalOptions>, default: () => ({}) },
    // `null` type: accept strings, elements and arrays without Vue's runtime type warnings.
    watch: { type: null as unknown as PropType<FormTarget | FormTarget[]>, default: undefined },
    requests: { type: [Boolean, Object] as PropType<boolean | WatchRequestsOptions>, default: false },
  },
  setup(props) {
    usePal({ ...props.options, watch: props.watch, requests: props.requests });
    return () => null;
  },
});
