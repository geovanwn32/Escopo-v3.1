
export type SecurityRuleContext = {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
    requestResourceData?: any;
    // We can add auth information here if needed, but it's often better
    // to let the server-side error message provide that for security.
  };
  
  /**
   * A custom error class for Firestore permission errors that includes
   * rich context about the failed request.
   */
  export class FirestorePermissionError extends Error {
    public readonly context: SecurityRuleContext;
  
    constructor(context: SecurityRuleContext) {
      const message = `Firestore permission denied for ${context.operation} on path '${context.path}'.`;
      super(message);
      this.name = 'FirestorePermissionError';
      this.context = context;
  
      // This is necessary for extending built-in classes like Error
      Object.setPrototypeOf(this, FirestorePermissionError.prototype);
    }
  
    /**
     * Converts the error to a plain JSON object, which is useful for logging
     * or for the Next.js error overlay.
     */
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        context: this.context,
        stack: this.stack,
      };
    }
  }
  