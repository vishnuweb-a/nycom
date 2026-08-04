import { CartProvider } from '@/context/CartProvider';
import { AppRouter } from '@/router/AppRouter';

/**
 * Application root.
 *
 * Global providers wrap `<AppRouter />` here. CartProvider sits outside the
 * router so a basket survives navigation between routes.
 */
const App = () => (
  <CartProvider>
    <AppRouter />
  </CartProvider>
);

export default App;
