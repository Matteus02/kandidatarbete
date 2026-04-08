<template>
  <div class="eis-container">
    <header>
      <h1>EIS Analyzer Pro</h1>
      <div class="controls">
        <label class="upload-btn">
          Ladda upp .csv
          <input type="file" @change="handleFileUpload" accept=".csv" />
        </label>

        <div class="view-toggle">
          <button 
            :class="{ active: currentView === 'nyquist' }" 
            @click="currentView = 'nyquist'"
          >
            Nyquist Plot
          </button>
          <button 
            :class="{ active: currentView === 'bode' }" 
            @click="currentView = 'bode'"
          >
            Bode Plot
          </button>
        </div>
      </div>
    </header>

    <main>
      <div class="plot-area">
        <div v-if="!dataLoaded" class="placeholder">
          Ingen data laddad. Vänligen ladda upp en .csv fil.
        </div>
        <div v-else>
          <h2>Visar: {{ currentView === 'nyquist' ? 'Nyquist ($Z_{re}$ vs $-Z_{im}$)' : 'Bode (Frekvens vs Fas/Amplitud)' }}</h2>
          <div class="graph-box">
            <p>Graf-komponent för {{ currentView }} hamnar här.</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const currentView = ref('nyquist'); // Håller koll på vilken vy som är aktiv
const dataLoaded = ref(false);
const rawData = ref(null);

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Här kan du skicka datan till en CSV-parser (t.ex. PapaParse)
      console.log("Fil laddad:", file.name);
      rawData.value = e.target.result;
      dataLoaded.value = true;
    };
    reader.readAsText(file);
  }
};
</script>

<style scoped>
.eis-container {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  color: #333;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #eee;
  padding-bottom: 20px;
}

.controls {
  display: flex;
  gap: 15px;
  align-items: center;
}

.upload-btn {
  background-color: #42b883;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.upload-btn input {
  display: none;
}

.view-toggle {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.view-toggle button {
  padding: 10px 15px;
  border: none;
  background: #f9f9f9;
  cursor: pointer;
}

.view-toggle button.active {
  background: #35495e;
  color: white;
}

.plot-area {
  margin-top: 40px;
  min-height: 400px;
  background: #fcfcfc;
  border: 1px dashed #ccc;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.graph-box {
  width: 100%;
  height: 350px;
  background: #fff;
  border: 1px solid #eee;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}
</style>