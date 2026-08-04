import { CartProvider } from '@/context/CartProvider';
import { ToastProvider } from '@/context/ToastProvider';
import { AppRouter } from '@/router/AppRouter';

/**
 * Application root.
 *
 * Providers sit outside the router so cart state and in-flight notifications
 * survive navigation between routes.
 */
const App = () => (
  <ToastProvider>
    <CartProvider>
      <AppRouter />
    </CartProvider>
  </ToastProvider>
);

export default App;
