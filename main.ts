import { App, Modal, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { DataSet, Network, Edge, Node, Options, Data } from 'vis-network/standalone';

interface Task {
  id: string;
  name: string;
  dependencies: string[];
  completed: boolean;
}

interface MyPluginSettings {
  mySetting: string;
  opacity: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mySetting: 'default',
  opacity: 1,
}

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;
  network: Network | null = null;

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

    modal.containerEl.style.opacity = String(this.settings.opacity);

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

          const completed = line.includes('- [x]');

          if (!taskIds.has(taskId)) {
            taskIds.add(taskId);
            tasks.push({
              id: taskId,
              name: taskName.replace(/\[[^\]]+\]/g, '').trim(),
              dependencies: dependsOn,
              completed,
            });
          }
        }
      });
    }

    console.log('Tasks:', tasks);
    return tasks;
  }

  renderGraph(container: HTMLElement, tasks: Task[]) {
    const nodes = new DataSet<Node>(
      tasks.map((task) => ({
        id: task.id,
        label: task.name,
        color: task.completed ? '#9BE7A4' : '#E7A49B',
      }))
    );
    console.log('Nodes:', nodes);

    const edges = new DataSet<Edge>(
      tasks.flatMap((task) =>
        task.dependencies.map((dep) => ({ from: dep, to: task.id }))
      )
    );
    console.log('Edges:', edges);

    const data: Data = {
      nodes: nodes,
      edges: edges,
    };

    const options: Options = {
      layout: {
        hierarchical: {
          direction: 'LR',
          sortMethod: 'directed',
        },
      },
      edges: {
        arrows: 'to',
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
      },
      manipulation: {
        enabled: true,
        addEdge: (edgeData: { from: string; to: string }, callback: (edgeData: { from: string; to: string } | null) => void) => {
          if (edgeData.from === edgeData.to) {
            alert('Cannot create self-dependency');
            callback(null);
            return;
          }
          callback(edgeData);
          this.updateTaskDependency(edgeData.from, edgeData.to);
        },
      },
    };

    this.network = new Network(container, data, options);

    this.network.on('click', (params) => {
      if (params.nodes.length === 1) {
        const nodeId = params.nodes[0];
        this.toggleTaskCompletion(nodeId);
      }
    });
  }

  async toggleTaskCompletion(taskId: string) {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      let updatedContent = '';

      for (const line of lines) {
        if (line.includes(`[id:${taskId}]`)) {
          if (line.startsWith('- [ ]')) {
            updatedContent += line.replace('- [ ]', '- [x]') + '\n';
          } else if (line.startsWith('- [x]')) {
            updatedContent += line.replace('- [x]', '- [ ]') + '\n';
          } else {
            updatedContent += line + '\n';
          }
        } else {
          updatedContent += line + '\n';
        }
      }

      await this.app.vault.modify(file, updatedContent.trim());
    }

    this.showTaskDependencyGraph();
  }

  async updateTaskDependency(fromTaskId: string, toTaskId: string) {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      let updatedContent = '';

      for (const line of lines) {
        if (line.includes(`[id:${toTaskId}]`)) {
          if (line.includes(`[dependsOn:${fromTaskId}]`)) {
            updatedContent += line + '\n';
          } else {
            updatedContent += line.replace(/\]$/, ` [dependsOn:${fromTaskId}]]`) + '\n';
          }
        } else {
          updatedContent += line + '\n';
        }
      }

      await this.app.vault.modify(file, updatedContent.trim());
    }

    this.showTaskDependencyGraph();
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

    new Setting(containerEl)
      .setName('Window Opacity')
      .setDesc('Set the opacity of the task dependency graph window')
      .addSlider(slider => slider
        .setLimits(0.1, 1, 0.1)
        .setValue(this.plugin.settings.opacity)
        .onChange(async (value) => {
          this.plugin.settings.opacity = value;
          await this.plugin.saveSettings();
        }));
  }
}