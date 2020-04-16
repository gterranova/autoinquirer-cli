import * as fs from "fs";
//import * as del from "delete";
import * as crypto from 'crypto';
import * as _ from "lodash";

import { AbstractDataSource } from 'autoinquirer/build/datasource';
import { IDispatchOptions, IProperty } from 'autoinquirer/build/interfaces';
import { Dispatcher } from 'autoinquirer';

function hash(key) {
  return crypto.pbkdf2Sync('secret', JSON.stringify(key), 100, 12, 'sha1').toString('hex');  // '3745e48...08d59ae'
}

export interface FileElement {
  _id?: string;
  isFolder: boolean;
  name: string;
  slug: string;
  dir: string
};

interface IPathInfo {
  fullPath?: string,
  folder?: string,
  filename?: string, 
  property?: string
}

export class FileSystemDataSource extends Dispatcher {
  rootDir: string;
  constructor(rootDir?: string) {
    super(null, null);
    this.rootDir = rootDir || '/';
  }
  public async connect() { };
  public async close() { };

  getDataSource(_parentDataSource?: AbstractDataSource) {
    return this;
  }
  
  getSchemaDataSource(_parentDataSource?: AbstractDataSource) {
    return { ...this, get: (options) => this.getSchema(options) };
  }

  private getPathInfo(options?: IDispatchOptions) : IPathInfo {
    const fullPath = _.compact([
      ...this.rootDir.split(RegExp('\\|\/')), 
      ...options?.params?.rootDir?.split(RegExp('\\|\/')), 
      ...options?.itemPath?.replace(RegExp(`^${options?.parentPath}[\\/|\\\\]?`), '').split(RegExp('\\|\/')) 
    ]).join('/');

    if (!fullPath) return {};
    const pathParts = fullPath.split('/');
    let folder = '.', filename = '', properties = [], idx = 0;
    while (pathParts.length) {
      const testPath = pathParts.join('/');
      if (fs.existsSync(testPath)) {
        if ((fs.lstatSync(testPath).isDirectory())) {
          folder = testPath;
        } else {
          filename = pathParts.pop();
          folder = pathParts.join('/');
        }
        break;
      } else {
        properties.unshift(pathParts.pop());
      }
    }
    const property = properties.join('/')
    return { fullPath: fullPath.replace(RegExp(`\/?${property}$`), ''), folder, filename, property};  
  };

  private getFiles(pathInfo: IPathInfo) : FileElement[] {
    const { fullPath, folder, filename } = pathInfo;
    if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
      //console.log(`FILES in ${dir}: currentPath ${currentPath} - remainingPath ${remainingPath}`);
      return _.sortBy(fs.readdirSync(fullPath, { withFileTypes: true }).map((element) => {
        return {
          name: `${element.isDirectory()?'[ ':''}${element.name}${element.isDirectory()?' ]':''}`,
          slug: element.name,
          dir: folder,
          isFolder: element.isDirectory()
        };
      }), [o => !o.isFolder, 'name']);
    } else {
      return [{
        name: filename,
        slug: filename,
        dir: folder,
        isFolder: false
      }]
    }
  }  

  public async getSchema(options?: IDispatchOptions): Promise<IProperty> {
    const { itemPath, parentPath, params } = options;
    //console.log(`FILESYSTEM getSchema(itemPath: ${itemPath} ... parentPath?: ${parentPath}, params?: ${params})`);
    const fileSchema = {
      type:"object", $title: "{{name}}",
      properties:{
        name:{ type: "string", title:"Name"},
        slug:{ type: "string", title:"Slug", readOnly: true},
        dir:{ type: "string", title:"Dir", readOnly: true},
        isFolder:{ type: "boolean", title:"isFolder", readOnly: true}
      }
    };
    const folderSchema = { type: "array", $title: "{{dir}}", items: fileSchema };
    const { filename, property } = this.getPathInfo(options);
    if (!filename) {
      return folderSchema
    }
    return property !== '' ? fileSchema.properties[property] : fileSchema;
  }

  public async get(options: IDispatchOptions): Promise<FileElement[]|FileElement> {
    const { itemPath, schema, value, parentPath, params } = options;
    //console.log(`FILESYSTEM get(itemPath: ${itemPath}, schema: ${JSON.stringify(schema)}, value: ${value}, parentPath: ${parentPath}, params: ${JSON.stringify(params)})`)
    const { fullPath, folder, filename, property } = this.getPathInfo(options);;
    const files = this.getFiles({ fullPath, folder, filename, property });
    //console.log(`FILES = "${JSON.stringify(files, null, 2)}"`)
    if (filename) {
        if (property) {
          return files[0][property];
        }
        return files[0];
    }
    return files;
  };

  public async set(options?: IDispatchOptions) {
    console.log(`FILESYSTEM set(itemPath: ${options.itemPath}, value: ${options.value}, parentPath: ${options.parentPath}, params: ${options.params})`)
  }

  public async update(options?: IDispatchOptions) {
    console.log(`FILESYSTEM update(itemPath: ${options.itemPath}, value: ${options.value}, parentPath: ${options.parentPath}, params: ${options.params})`)
    /*
    if (options?.value !== undefined) {
      if (options?.itemPath) {
        const files = [];
        const dir = join(this.rootDir, options?.params?.rootDir);
        for await (const f of getFiles(dir, options?.itemPath)) { files.push(f); };
        return files.map((f: FileElement) => {
          const currentPath = join(f.dir, f.name);
          const newPath = join(this.rootDir, options?.params?.rootDir, options?.value?.dir, options?.value?.name);
          if (currentPath !== newPath) {
            fs.renameSync(currentPath, newPath)
          }
        });
      }
      return options?.value;
    }
    */
  }

  public async del(options?: IDispatchOptions) {
    console.log(`FILESYSTEM del(itemPath: ${options?.itemPath}, schema: ${options?.schema}, value: ${options?.value}, parentPath: ${options?.parentPath}, params: ${options?.params})`)
    /*
    if (options?.itemPath) {
      const files = [];
      const dir = join(this.rootDir, options?.params?.rootDir);
      for await (const f of getFiles(dir, options?.itemPath)) { files.push(f); };
      //del(files.map((f: FileElement) => join(f.dir, f.name)));
    }
    */
  };
  
  public async dispatch(methodName: string, options?: IDispatchOptions): Promise<any> {
    //console.log(`FILESYSTEM dispatch(methodName: ${methodName}, itemPath: ${itemPath}, schema: ${schema}, value: ${value}, parentPath: ${parentPath}, params: ${JSON.stringify(params)})`)
    options = options || {};

    if (!this[methodName]) {
      throw new Error(`Method ${methodName} not implemented`);
    }

    // tslint:disable-next-line:no-return-await
    return await this[methodName].call(this, options);
  };

}
