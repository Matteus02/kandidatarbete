<script setup lang="ts">
import { ref, onMounted, provide, render } from 'vue'
import ResistorSymbol from '@/components/circuit/ResistorSymbol.vue'
import CapacitorSymbol from '@/components/circuit/CapacitorSymbol.vue'
import CpeSymbol from '@/components/circuit/CpeSymbol.vue'
import WarburgSymbol from '@/components/circuit/WarburgSymbol.vue'
import ParallellSymbol from '../circuit/ParallellSymbol.vue'
import { CircuitNode } from '@/components/circuit/CircuitNode'
import type { ElementType } from '@/components/circuit/CircuitNode'
import CircuitRenderer from '@/components/circuit/CircuitRenderer.vue'
import CircuitValue from '@/components/circuit/CircuitValue.vue'
import { parallel } from '@/utils/impedance'

const svgHeight = 250;
const svgWidth = 800;
const buttonWidth = 100;
const buttonHeight = 50;

const renderVersion = ref(0)

const RIdCounter = ref(1);
const CIdCounter = ref(0);
const CpeIdCounter = ref(0);
const WIdCounter = ref(0);

const rootNode = ref(new CircuitNode('R0', 'R', 10));

const handleDragStart = (event: DragEvent, type: ElementType) => {
  console.log('Startar drag av typ:', type);
  if (event.dataTransfer) {
    event.dataTransfer.setData('componentType', type);
    event.dataTransfer.effectAllowed = 'copy';
  }
};

const handleNodeDrop = (targetNode: CircuitNode, newType: ElementType, action: 'before' | 'replace' | 'after') => {
  let newId = '';

  if (newType === 'R') {
    newId = `R${RIdCounter.value++}` as ElementType;
  } else if (newType === 'C') {
    newId = `C${CIdCounter.value++}` as ElementType;
  } else if (newType === 'CPE') {
    newId = `CPE${CpeIdCounter.value++}` as ElementType;
  } else if (newType === 'W') {
    newId = `W${WIdCounter.value++}` as ElementType;
  }

  
  const newNode = new CircuitNode(newId, newType, 0)

  if (action === 'before') {
    newNode.setNext(targetNode);
    newNode.setEarlier(targetNode.earlier);

    if (targetNode === rootNode.value) rootNode.value = newNode;
    else if (targetNode.earlier?.upperBranch === targetNode) targetNode.earlier.upperBranch = newNode;
    else if (targetNode.earlier?.lowerBranch === targetNode) targetNode.earlier.lowerBranch = newNode;
    else if (targetNode.earlier) targetNode.earlier.setNext(newNode);

    targetNode.setEarlier(newNode);
  } 
  
  else if (action === 'replace') {
    newNode.setEarlier(targetNode.earlier);
    newNode.setNext(targetNode.next);

    if (targetNode === rootNode.value) rootNode.value = newNode;
    else if (targetNode.earlier?.upperBranch === targetNode) targetNode.earlier.upperBranch = newNode;
    else if (targetNode.earlier?.lowerBranch === targetNode) targetNode.earlier.lowerBranch = newNode;
    else if (targetNode.earlier) targetNode.earlier.setNext(newNode);

    if (targetNode.next) targetNode.next.setEarlier(newNode);
  } 
  
  else if (action === 'after') {
    const oldNext = targetNode.next;
    targetNode.setNext(newNode);
    newNode.setEarlier(targetNode);

    if (oldNext) {
      newNode.setNext(oldNext);
      oldNext.setEarlier(newNode);
    }
  }

  renderVersion.value++
}

const insertIntoEmptyBranch = (parentNode: CircuitNode, branch: 'upper' | 'lower', newType: string) => {
  let newId = '';

  if (newType === 'R') {
    newId = `R${RIdCounter.value++}` as ElementType;
  } else if (newType === 'C') {
    newId = `C${CIdCounter.value++}` as ElementType;
  } else if (newType === 'CPE') {
    newId = `CPE${CpeIdCounter.value++}` as ElementType;
  } else if (newType === 'W') {
    newId = `W${WIdCounter.value++}` as ElementType;
  }
  const newNode = new CircuitNode(newId, newType as ElementType, 10);
  
  newNode.setEarlier(parentNode);
  if (branch === 'upper') parentNode.upperBranch = newNode;
  else parentNode.lowerBranch = newNode;
  
  renderVersion.value++;
};


const deleteNode = (node: CircuitNode) => {
  console.log('Tar bort nod från trädet:', node.id)


  //if (node.type === 'R') {
  //  RIdCounter.value--;
  //} else if (node.type === 'C') {
  //  CIdCounter.value--;
  //} else if (node.type === 'CPE') {
  //  CpeIdCounter.value-- ;
  //} else if (node.type === 'W') {
  //  WIdCounter.value--;
  //}

  if (node === rootNode.value) {    
    rootNode.value = node.next || new CircuitNode('end', 'end');
  } else {
    node.removeNode();
  }
  renderVersion.value++;
};

provide('handleNodeDrop', handleNodeDrop);
provide('insertIntoEmptyBranch', insertIntoEmptyBranch);
provide('deleteNode', deleteNode);





onMounted(() => {
  const c1 = new CircuitNode('C1', 'C', 0.001);
  const endNode = new CircuitNode('end', 'end', 0);
  const parallelNode = new CircuitNode('p1', 'parallel', 0);
  const c2 = new CircuitNode('C2', 'C', 0.001);
  const c3 = new CircuitNode('C3', 'C', 0.001);
  const parallel2 = new CircuitNode('p2', 'parallel', 0);
  const r2 = new CircuitNode('R2', 'R', 100);

  rootNode.value.setNext(r2);
  r2.setEarlier(rootNode.value);
  r2.setNext(parallelNode);


  
  parallelNode.setEarlier(r2)

  parallelNode.setUpperBranch(c2);
  c2.setEarlier(parallelNode);

  c2.setNext(c3);
  c3.setEarlier(c2);

  parallelNode.setLowerBranch(parallel2);
  parallel2.setEarlier(parallelNode);

  parallelNode.setNext(c1);
  c1.setEarlier(parallelNode);
  c1.setNext(endNode);

  
});
</script>

<template>
<p>ECM Module</p>

    <div class="circuitBox">
      <svg class="circuit-svg" :width="svgWidth" :height="svgHeight" style="overflow: visible" :key="renderVersion">
        <CircuitRenderer 
        v-if="rootNode" 
        :node="rootNode" 
        :x="50" 
        :y="svgHeight / 2" 
        />
      </svg>

      <div class="buttonBox" :style="{display: 'flex', width: (buttonWidth * 5) + 'px', height: buttonHeight + 'px'}">
        <div class="drag-handle" draggable="true" @dragstart="handleDragStart($event, 'R')">
          <svg class="componentButton" :width="buttonWidth" :height="buttonHeight" draggable="true" @dragstart="handleDragStart($event, 'R')" style="cursor: grab;">
            <rect width="100%" height="100%" fill="transparent" />
            <g class="circuitIcon" :transform="`translate(20, ${buttonHeight / 2 - 2})`">
              <ResistorSymbol label="" />
            </g>
          </svg>
        </div>

        <div class="drag-handle" draggable="true" @dragstart="handleDragStart($event, 'C')">
          <svg class="componentButton" :width="buttonWidth" :height="buttonHeight" draggable="true" @dragstart="handleDragStart($event, 'C')" style="cursor: grab;">
              <rect width="100%" height="100%" fill="transparent" />
              <g class="circuitIcon" :transform="`translate(20, ${buttonHeight / 2 - 2})`">
                <CapacitorSymbol label="" />
              </g>
          </svg>
        </div>
        <div class="drag-handle" draggable="true" @dragstart="handleDragStart($event, 'CPE')">
          <svg class="componentButton" :width="buttonWidth" :height="buttonHeight">
              <rect width="100%" height="100%" fill="transparent" />
              <g class="circuitIcon":transform="`translate(20, ${buttonHeight / 2 - 2})`">
                <CpeSymbol label="" />
              </g>
          </svg>
        </div>

        <div class="drag-handle" draggable="true" @dragstart="handleDragStart($event, 'W')">
          <svg class="componentButton" :width="buttonWidth" :height="buttonHeight">
              <rect width="100%" height="100%" fill="transparent" />
              <g :transform="`translate(20, ${buttonHeight / 2 - 2})`">
                <WarburgSymbol label="" />
              </g>
          </svg>
        </div>

        <div class="drag-handle" draggable="true" @dragstart="handleDragStart($event, 'parallel')">
          <svg class="componentButton" :width="buttonWidth" :height="buttonHeight">
              <rect width="100%" height="100%" fill="transparent" />
              <g :transform="`translate(20, ${buttonHeight / 2 - 2})`">
                <ParallellSymbol />
              </g>
          </svg>
        </div>
      </div>

      
    </div>

    <div class="valueBox">
      <svg :width="svgWidth" :height="svgHeight" style="overflow: visible">
        <CircuitValue :node="rootNode" :x="10" :y="10" :amount="0" />
      </svg>
        

    </div>
</template>

<style scoped>
.circuit-svg {
  border: 1px solid #000000;
  border-radius: 12px;
}

.drag-handle {
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  background-color: #f8f8f8; /* Frivilligt: Ger knapparna en liten bakgrund */
  border: 1px solid #ddd;
  border-radius: 6px;
  margin: 2px;
}
</style>