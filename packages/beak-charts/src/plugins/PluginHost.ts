import type { Plugin, PluginHook, PluginContext } from '../types.ts';

export class PluginHost {
  private _plugins = new Map<string, Plugin>();

  register(plugin: Plugin): void {
    this._plugins.set(plugin.name, plugin);
  }

  unregister(name: string): void {
    this._plugins.delete(name);
  }

  invoke(hook: PluginHook, context: PluginContext): void {
    for (const plugin of this._plugins.values()) {
      const fn = plugin.hooks[hook];
      if (fn) fn(context);
    }
  }

  getPlugins(): Plugin[] {
    return Array.from(this._plugins.values());
  }
}
