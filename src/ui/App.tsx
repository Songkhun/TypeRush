import { useState } from 'react';
import { AppProvider } from './AppContext';
import { ArcadeScreen } from './ArcadeScreen';
import { FxLayer } from './FxLayer';
import { HomeScreen } from './HomeScreen';
import { SettingsScreen } from './SettingsScreen';
import { StatsScreen } from './StatsScreen';
import { TopBar } from './TopBar';
import { TypingScreen } from './TypingScreen';

export type Screen = 'home' | 'test' | 'drill' | 'arcade' | 'stats' | 'settings';

function Shell() {
  const [screen, setScreen] = useState<Screen>('home');
  return (
    <div className="app">
      <TopBar screen={screen} onNav={setScreen} />
      <main>
        {screen === 'home' && <HomeScreen onNav={setScreen} />}
        {screen === 'test' && <TypingScreen key="test" mode="test" />}
        {screen === 'drill' && <TypingScreen key="drill" mode="drill" />}
        {screen === 'arcade' && <ArcadeScreen onExit={() => setScreen('home')} />}
        {screen === 'stats' && <StatsScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <FxLayer>
        <Shell />
      </FxLayer>
    </AppProvider>
  );
}
