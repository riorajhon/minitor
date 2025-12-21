import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import CombinedCountryTable from './components/CombinedCountryTable';
import CountryDetail from './components/CountryDetail';

function App() {
  return (
    <Provider store={store}>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<CombinedCountryTable />} />
            <Route path="/country/:countryIdentifier" element={<CountryDetail />} />
          </Routes>
        </div>
      </Router>
    </Provider>
  );
}

export default App;