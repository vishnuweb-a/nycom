import { AppRouter } from '@/router/AppRouter';

/**
 * Application root.
 *
 * Global providers (CartContext, ThemeContext, AuthContext, Toast) wrap
 * `<AppRouter />` here as each is introduced.
 */
const App = () => <AppRouter />;

export default App;
