import { Project, ArangoStore, CLI } from '../index.js'
import { CliUx, Command, Interfaces } from '@oclif/core';
import is from '@sindresorhus/is';

/**
 * A base command that provided common functionality for all Spidergram commands.
 * Most of these options are possible to wire together with tools in the Oclif library,
 * but the SpiderCommand class puts the simplest/standard approach within easy reach when
 * building a command.
 *
 * Functionality includes:
 *  - Easy instantiation of spidergram project context
 *  - A growing cluster of support functions
 *  - stylized output (JSON, url, objects, headers)
 *  - Convenience wrappers for prompts and complex status updates
 *
 * All implementations of this class need to implement the run() method.
 */

export abstract class SgCommand extends Command {
  static enableJsonFlag = true;

  ux = CliUx.ux;
  format = CLI.Colors;
  chalk = CLI.chalk;
  symbol = CLI.Prefixes;

  protected get statics(): typeof SgCommand {
    return this.constructor as typeof SgCommand;
  }

  // If no flags are set for a Spidergram Command, inherit
  // the shared global flags.
  static flags: Interfaces.FlagInput = {
    config: CLI.globalFlags.config
  }

  async getProjectContext(returnErrors = false) {
    const errors: Error[] = [];
    let project = {} as unknown as Project;
    let graph = {} as unknown as ArangoStore;

    try {
      const {flags} = await this.parse(this.constructor as typeof SgCommand);
      const _configFilePath = is.string(flags.config) ? flags.config : undefined;
      project = await Project.config({ _configFilePath });
      graph = await project.graph();
    } catch(error: unknown) {
      if (is.error(error)) {
        errors.push(error);

        if (errors.length > 0 && !returnErrors) {
          for (let error of errors) this.ux.error(error);
        }
      }
    }
    
    return {
      project,
      graph,
      errors
    }
  }
}