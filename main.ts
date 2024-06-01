import { App, Modal, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { DataSet, Network, Edge } from 'vis-network/standalone';

interface Task {
  id: string;
  name: string;
  dependencies: string[];
}

interface MyPluginSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mySetting: 'default'
}

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    await this.loadSettings();

    this.addRibbonIcon('dice', 'Task Dependencies', () => {
      this.showTaskDependencyGraph();
    });

    this.addSettingTab(new MyPluginSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async showTaskDependencyGraph() {
    const tasks: Task[] = await this.getTasksFromNotes();

    const container = document.createElement('div');
    container.classList.add('task-dependency-graph');
    container.style.width = '100%';
    container.style.height = '400px';
    container.style.border = '1px solid black';

    const modal = new Modal(this.app);
    modal.titleEl.setText('Task Dependency Graph');
    modal.contentEl.appendChild(container);

    this.renderGraph(container, tasks);

    modal.open();
  }

  async getTasksFromNotes(): Promise<Task[]> {
    const tasks: Task[] = [];
    const taskIds: Set<string> = new Set();
    let uniqueId = 1;

    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const lines = content.split('\n');
      lines.forEach((line: string) => {
        const taskMatch = line.match(/- \[[ x]\] (.+)/);
        if (taskMatch) {
          const taskName = taskMatch[1].trim();

          const idMatch = taskName.match(/\[id:(\w+)\]/);
          const taskId = idMatch ? idMatch[1] : `task${uniqueId++}`;

          const dependsOnMatch = taskName.match(/\[dependsOn:(\w+)\]/g);
          const dependsOn = dependsOnMatch ? dependsOnMatch.map(match => match.slice(11, -1)) : [];

          if (!taskIds.has(taskId)) {
            taskIds.add(taskId);
            tasks.push({
              id: taskId,
              name: taskName.replace(/\[[^\]]+\]/g, '').trim(),
              dependencies: dependsOn,
            });
          }
        }
      });
    }

    console.log('Tasks:', tasks);
    return tasks;
  }

  renderGraph(container: HTMLElement, tasks: Task[]) {
    const nodes = new DataSet(
      tasks.map((task) => ({ id: task.id, label: task.name }))
    );
    console.log('Nodes:', nodes);

    const edges = new DataSet<Edge>(
      tasks.flatMap((task) =>
        task.dependencies.map((dep) => ({ from: dep, to: task.id }))
      )
    );
    console.log('Edges:', edges);

    const data = {
      nodes: nodes,
      edges: edges,
    };

    const options = {
      layout: {
        hierarchical: {
          direction: 'LR',
          sortMethod: 'directed',
        },
      },
      edges: {
        arrows: 'to',
      },
    };

    new Network(container, data, options);
  }
}

class MyPluginSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Settings for my plugin.' });

    new Setting(containerEl)
      .setName('Setting #1')
      .setDesc('It\'s a secret')
      .addText(text => text
        .setPlaceholder('Enter your secret')
        .setValue(this.plugin.settings.mySetting)
        .onChange(async (value) => {
          this.plugin.settings.mySetting = value;
          await this.plugin.saveSettings();
        }));
  }
}