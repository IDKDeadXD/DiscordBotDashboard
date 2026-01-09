const Docker = require('dockerode');
const fs = require('fs').promises;
const path = require('path');

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
const BOTS_NETWORK = process.env.BOTS_NETWORK || 'discord-bots-network';

async function ensureNetwork() {
    try {
        const networks = await docker.listNetworks({
            filters: { name: [BOTS_NETWORK] }
        });

        if (networks.length === 0) {
            await docker.createNetwork({
                Name: BOTS_NETWORK,
                Driver: 'bridge'
            });
            console.log(`✓ Created Docker network: ${BOTS_NETWORK}`);
        }
    } catch (error) {
        console.error('Error ensuring network:', error);
        throw error;
    }
}

async function createBotContainer(botConfig) {
    await ensureNetwork();

    const containerName = `discord-bot-${botConfig.bot_id}`;
    const volumeName = `bot-data-${botConfig.bot_id}`;

    try {
        const existingContainers = await docker.listContainers({
            all: true,
            filters: { name: [containerName] }
        });

        if (existingContainers.length > 0) {
            const container = docker.getContainer(existingContainers[0].Id);
            await container.remove({ force: true });
        }

        const volumes = await docker.listVolumes({
            filters: { name: [volumeName] }
        });

        if (volumes.Volumes.length === 0) {
            await docker.createVolume({ Name: volumeName });
        }

        const dockerfilePath = path.join(__dirname, '../../docker/templates/bot-dockerfile');
        const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');

        const container = await docker.createContainer({
            Image: 'node:18-alpine',
            name: containerName,
            Env: [
                `DISCORD_TOKEN=${botConfig.token}`,
                `BOT_ID=${botConfig.bot_id}`,
                `BOT_NAME=${botConfig.name}`,
                ...Object.entries(botConfig.settings || {}).map(([key, value]) => `${key}=${value}`)
            ],
            HostConfig: {
                NetworkMode: BOTS_NETWORK,
                RestartPolicy: {
                    Name: botConfig.auto_restart ? 'unless-stopped' : 'no'
                },
                Binds: [
                    `${volumeName}:/app/data`
                ],
                Memory: 512 * 1024 * 1024,
                MemorySwap: 512 * 1024 * 1024
            },
            Labels: {
                'discord-bot-dashboard': 'true',
                'bot-id': botConfig.bot_id.toString(),
                'owner-id': botConfig.owner_id.toString()
            }
        });

        return {
            containerId: container.id,
            containerName: containerName
        };
    } catch (error) {
        console.error('Error creating container:', error);
        throw error;
    }
}

async function startContainer(containerId) {
    try {
        const container = docker.getContainer(containerId);
        await container.start();
        return true;
    } catch (error) {
        console.error('Error starting container:', error);
        throw error;
    }
}

async function stopContainer(containerId) {
    try {
        const container = docker.getContainer(containerId);
        await container.stop({ t: 10 });
        return true;
    } catch (error) {
        console.error('Error stopping container:', error);
        throw error;
    }
}

async function restartContainer(containerId) {
    try {
        const container = docker.getContainer(containerId);
        await container.restart({ t: 10 });
        return true;
    } catch (error) {
        console.error('Error restarting container:', error);
        throw error;
    }
}

async function removeContainer(containerId) {
    try {
        const container = docker.getContainer(containerId);
        await container.remove({ force: true });
        return true;
    } catch (error) {
        console.error('Error removing container:', error);
        throw error;
    }
}

async function getContainerStatus(containerId) {
    try {
        const container = docker.getContainer(containerId);
        const info = await container.inspect();

        return {
            status: info.State.Running ? 'running' : 'stopped',
            startedAt: info.State.StartedAt,
            finishedAt: info.State.FinishedAt,
            exitCode: info.State.ExitCode,
            error: info.State.Error
        };
    } catch (error) {
        if (error.statusCode === 404) {
            return { status: 'not_found' };
        }
        throw error;
    }
}

async function getContainerLogs(containerId, tail = 100) {
    try {
        const container = docker.getContainer(containerId);
        const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: tail,
            timestamps: true
        });

        return logs.toString('utf8');
    } catch (error) {
        console.error('Error getting container logs:', error);
        throw error;
    }
}

async function getContainerStats(containerId) {
    try {
        const container = docker.getContainer(containerId);
        const stats = await container.stats({ stream: false });

        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

        const memoryUsage = stats.memory_stats.usage;
        const memoryLimit = stats.memory_stats.limit;
        const memoryPercent = (memoryUsage / memoryLimit) * 100;

        return {
            cpu: cpuPercent.toFixed(2),
            memory: {
                usage: (memoryUsage / 1024 / 1024).toFixed(2),
                limit: (memoryLimit / 1024 / 1024).toFixed(2),
                percent: memoryPercent.toFixed(2)
            }
        };
    } catch (error) {
        console.error('Error getting container stats:', error);
        throw error;
    }
}

module.exports = {
    createBotContainer,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
    getContainerStatus,
    getContainerLogs,
    getContainerStats
};
