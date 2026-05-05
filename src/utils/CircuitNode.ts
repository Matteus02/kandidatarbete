export type ElementType = 'R' | 'C' | 'CPE' | 'W' | 'Wo' | 'Ws' | 'L' | 'parallel' | 'end' | 'empty';
export const NODE_HEIGHT = 38;
export const HORIZONTAL_SPACING = 30;
export const NODE_WIDTH = 60;
export const PARALLEL_SPACING = 21;

// Standard physically meaningful limits for EIS parameters
export const LIMITS: Record<ElementType, { min: number; max: number; min2?: number; max2?: number }> = {
  R:        { min: 1e-3,  max: 1e9 },
  C:        { min: 1e-15, max: 100 },
  L:        { min: 1e-15, max: 100 },
  CPE:      { min: 1e-15, max: 100, min2: 0.1, max2: 1.0 },
  W:        { min: 1e-3,  max: 1e9 },
  Wo:       { min: 1e-3,  max: 1e9, min2: 1e-6, max2: 1e6 },
  Ws:       { min: 1e-3,  max: 1e9, min2: 1e-6, max2: 1e6 },
  parallel: { min: 0,     max: 0 },
  end:      { min: 0,     max: 0 },
  empty:    { min: 0,     max: 0 },
}

export class CircuitNode {
  public id: string;
  public type: ElementType;
  public value: number;
  public value2: number; // second parameter for two-param elements (Wo: tau, Ws: tau)
  public earlier: CircuitNode | null;
  public next: CircuitNode | null;
  public upperBranch: CircuitNode | null;
  public lowerBranch: CircuitNode | null;

  // New constraints properties
  public locked: boolean = false;
  public locked2: boolean = false;
  public min: number | null = null;
  public max: number | null = null;
  public min2: number | null = null;
  public max2: number | null = null;

  constructor(id: string, type: ElementType, value: number = 0, value2: number = 1.0) {
    this.id = id;
    this.type = type;
    this.value = value;
    this.value2 = value2;
    this.earlier = null;
    this.next = null;
    this.upperBranch = null;
    this.lowerBranch = null;
  }

  applyDefaultLimits() {
    const lim = LIMITS[this.type]
    this.min = lim.min
    this.max = lim.max
    if (lim.min2 !== undefined) this.min2 = lim.min2
    if (lim.max2 !== undefined) this.max2 = lim.max2
  }

  setUpperBranch(node: CircuitNode | null) {
    this.upperBranch = node;
  }

  setLowerBranch(node: CircuitNode | null) {
    this.lowerBranch = node;
  }

  setNext(nextNode: CircuitNode | null) {
    this.next = nextNode;
  }

  setEarlier(node: CircuitNode | null) {
    this.earlier = node;
  }

  getNext() {
    return this.next;
  }

  getEarlier() {
    return this.earlier;
  }

  createNode( earlierNode: CircuitNode | null, nextNode: CircuitNode | null ){
    earlierNode?.setNext(this);
    this.setEarlier(earlierNode);
    this.setNext(nextNode);
    nextNode?.setEarlier(this);
  }


  //Används inte
  countAmount(): number {
    //console.log(`Counting amount for node ${this.id} of type ${this.type}`);

    if (this.type === 'end') return 0;
    if (this.type === 'parallel'){
        const upperAmount = this.upperBranch ? this.upperBranch.countAmount() : 0;
        const lowerAmount = this.lowerBranch ? this.lowerBranch.countAmount() : 0;
        return upperAmount + lowerAmount + (this.next?.countAmount() ?? 0);
    }
    return 1 + (this.next?.countAmount() ?? 0);
  }

  countLength(): number {
    if (this.type === 'end') return 0;
    if (this.type === 'parallel') {
        const upperLength = this.upperBranch?.countMaxLength();
        const lowerLength = this.lowerBranch?.countMaxLength();
        if (upperLength === 0 && lowerLength === 0) {
            return NODE_WIDTH;
        }
        return Math.max(upperLength || NODE_WIDTH, lowerLength || NODE_WIDTH) + HORIZONTAL_SPACING*2;
    }
    return NODE_WIDTH;
  }

  countMaxLength(): number {
    if (this.type === 'end') return 0;
    const currentLength = this.countLength();
    if (!this.next || this.next.type === 'end') {
      return currentLength;
    }
    return currentLength + HORIZONTAL_SPACING + this.next.countMaxLength();
  }

  countHeight(): number {
    if (this.type === 'parallel') {
        const upperHeight = this.upperBranch?.countMaxHeight() || NODE_HEIGHT;
        const lowerHeight = this.lowerBranch?.countMaxHeight() || NODE_HEIGHT;
        return Math.max(upperHeight, lowerHeight) + 2 * PARALLEL_SPACING;
    }
    else {
        return NODE_HEIGHT;
    }
  }

  countMaxHeight(): number {
    return Math.max(this.countHeight(), this.next?.countMaxHeight() || NODE_HEIGHT);
  }

  removeNode() {
    if (this.type === 'end') return;

  if (this.earlier) {
    if (this.earlier.upperBranch === this) {
      this.earlier.upperBranch = this.next;
    } else if (this.earlier.lowerBranch === this) {
      this.earlier.lowerBranch = this.next;
    } else {
      this.earlier.setNext(this.next);
    }
  }

  if (this.next) {
    this.next.setEarlier(this.earlier);
  }
  }
//Troligen också inte använd
  placeNode(beforeNode: CircuitNode | null, afterNode: CircuitNode | null) {
    if (beforeNode) {
      beforeNode.setNext(this);
      this.setEarlier(beforeNode);
    }
    if (afterNode) {
      afterNode.setEarlier(this);
      this.setNext(afterNode);
    }
  }
}
