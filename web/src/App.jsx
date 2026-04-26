import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HeroPage from './pages/HeroPage';
import InputPage from './pages/InputPage';
import ReviewPage from './pages/ReviewPage';
import ResultPage from './pages/ResultPage';
import ExplainPage from './pages/ExplainPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Layout />}>
          <Route index element={<HeroPage />} />
          <Route path='input' element={<InputPage />} />
          <Route path='review' element={<ReviewPage />} />
          <Route path='result' element={<ResultPage />} />
          <Route path='explain' element={<ExplainPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
