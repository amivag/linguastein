import {
  createContext,
  useContext,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react';
import { registerFocusScope } from './focus-scope';

/** Logical ancestry survives portals, including nested dialogs mounted together. */
export const FocusScopeContext = createContext<object | null>(null);

export function useFocusTrap<T extends HTMLElement>(
  onClose: () => void,
  layer?: RefObject<HTMLElement | null>,
) {
  const ref = useRef<T>(null);
  const parent = useContext(FocusScopeContext);
  const close = useEffectEvent(onClose);
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    return registerFocusScope({
      id: ref,
      parent,
      container,
      layer: layer?.current ?? container,
      close: () => close(),
    });
  }, [parent, layer]);
  return ref;
}
