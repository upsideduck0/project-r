export type DevCommandHandler = (args: string[]) => string;

export class DevConsole {
  private root: HTMLDivElement;
  private logEl: HTMLDivElement;
  private input: HTMLInputElement;
  private commands = new Map<string, DevCommandHandler>();
  private history: string[] = [];
  private historyIdx = -1;
  private open = false;
  private windowKeyHandler: (e: KeyboardEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;

  constructor() {
    this.root = document.createElement("div");
    this.root.style.cssText = [
      "position:fixed",
      "left:0",
      "right:0",
      "bottom:0",
      "max-height:42vh",
      "background:rgba(8,10,16,0.92)",
      "color:#cfd6e6",
      "font-family:monospace",
      "font-size:13px",
      "padding:8px",
      "z-index:9999",
      "display:none",
      "border-top:2px solid #4a5072",
    ].join(";");

    this.logEl = document.createElement("div");
    this.logEl.style.cssText = [
      "overflow-y:auto",
      "max-height:34vh",
      "margin-bottom:6px",
      "white-space:pre-wrap",
      "line-height:1.4",
    ].join(";");

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.spellcheck = false;
    this.input.autocomplete = "off";
    this.input.placeholder = "type a command, e.g. /spawn tank";
    this.input.style.cssText = [
      "width:100%",
      "box-sizing:border-box",
      "padding:6px 8px",
      "background:#1a1d2b",
      "color:#e6e6e6",
      "border:1px solid #4a5072",
      "outline:none",
      "font:13px monospace",
    ].join(";");

    this.root.append(this.logEl, this.input);
    document.body.append(this.root);

    this.log("[DEV] console ready. press ` to toggle.");
    this.log("[DEV] available: /spawn <type>, /give <id>, /fh, /help");

    this.windowKeyHandler = (e: KeyboardEvent) => {
      if (e.key === "`" || e.key === "~") {
        e.preventDefault();
        this.toggle();
      } else if (e.key === "Escape" && this.open) {
        e.preventDefault();
        this.hide();
      }
    };
    window.addEventListener("keydown", this.windowKeyHandler, true);

    this.input.addEventListener("keydown", (e) => {
      // Don't let game keys leak to Phaser while typing.
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        const text = this.input.value.trim();
        if (!text) return;
        this.history.push(text);
        this.historyIdx = this.history.length;
        this.log("> " + text);
        const out = this.execute(text);
        if (out) this.log(out);
        this.input.value = "";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.history.length === 0) return;
        this.historyIdx = Math.max(0, this.historyIdx - 1);
        this.input.value = this.history[this.historyIdx] ?? "";
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (this.historyIdx < this.history.length - 1) {
          this.historyIdx++;
          this.input.value = this.history[this.historyIdx];
        } else {
          this.historyIdx = this.history.length;
          this.input.value = "";
        }
      } else if (e.key === "`" || e.key === "~") {
        e.preventDefault();
        this.hide();
      }
    });

    // Built-in /help command lists everything registered.
    this.register("help", () => {
      const names = Array.from(this.commands.keys()).sort();
      return "[DEV] commands: " + names.map((n) => "/" + n).join(", ");
    });
  }

  register(name: string, fn: DevCommandHandler): void {
    this.commands.set(name, fn);
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  show(): void {
    this.root.style.display = "block";
    this.open = true;
    // Defer focus so the toggling keystroke isn't typed into the input.
    setTimeout(() => this.input.focus(), 0);
    this.onOpen?.();
  }

  hide(): void {
    this.root.style.display = "none";
    this.open = false;
    this.input.blur();
    this.onClose?.();
  }

  isOpen(): boolean {
    return this.open;
  }

  log(line: string): void {
    const div = document.createElement("div");
    div.textContent = line;
    this.logEl.append(div);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  destroy(): void {
    window.removeEventListener("keydown", this.windowKeyHandler, true);
    this.root.remove();
  }

  private execute(raw: string): string {
    const stripped = raw.startsWith("/") ? raw.slice(1) : raw;
    const parts = stripped.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);
    const fn = this.commands.get(name);
    if (!fn) return `[DEV] unknown command: ${name}`;
    try {
      return fn(args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `[DEV] error: ${msg}`;
    }
  }
}
