import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './screens/Login';
import Register from './screens/Register';
import ForgotPassword from './screens/ForgotPassword';
import Dashboard from './screens/Dashboard';
import CreateRoom from './screens/CreateRoom';
import BettorPage from './screens/BettorPage';
import Report from './screens/Report';
import BuyTokens from './screens/BuyTokens';
import Profile from './screens/Profile';
import { AuthProvider } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthRoute from './components/AuthRoute';
import NavigationLayout from './components/NavigationLayout';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
            <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
            
            <Route element={<ProtectedRoute><NavigationLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create-room" element={<CreateRoom />} />
              <Route path="/resenha/:id/report" element={<Report />} />
              <Route path="/buy-tokens" element={<BuyTokens />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            
            <Route path="/resenha/:id" element={<BettorPage />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
